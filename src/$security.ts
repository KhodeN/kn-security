/// <reference path="../kn-security.d.ts" />

import 'lodash-ext';
import IAuthApiService = KN.IAuthApiService;
import ICacheObject = ng.ICacheObject;
import ICurrentUser = KN.ICurrentUser;
import IDeferred = ng.IDeferred;
import IQService = ng.IQService;
import IRoleStore = ng.permission.IRoleStore;
import IRootScope = KN.IRootScope;
import IRoute = KN.IRoute;
import ISecurityService = KN.ISecurityService;
import IState = ng.ui.IState;
import IStatePermissions = ng.permission.IStatePermissions;
import IStateService = ng.ui.IStateService;
import ITabEvents = KN.ITabEvents;
import IAngularEvent = angular.IAngularEvent;

export class SecurityService implements ISecurityService {
    private _currentUser: ICurrentUser;
    private _loadUserDeferred: IDeferred<ICurrentUser>;
    private _waitLoginDeferred: IDeferred<ICurrentUser>;

    public static $inject = [
        '$rootScope',
        '$q',
        '$authApi',
        'store',
        'RoleStore',
        'userGroups',
        '$state',
        '$tabEvents',
        'homeRoute',
        'loginRoute',
        'acl'
    ];

    constructor(private $rootScope: IRootScope,
                private $q: IQService,
                private $authApi: IAuthApiService<ICurrentUser>,
                private store: ICacheObject,
                /* tslint:disable:variable-name */
                private RoleStore: IRoleStore,
                /* tslint:enable:variable-name */
                private userGroups: string[],
                private $state: IStateService,
                private $tabEvents: ITabEvents,
                private homeRoute: IRoute,
                private loginRoute: IRoute,
                private logoutRoute: IRoute,
                private acl: any) {
        this.$rootScope.hasRole = <any>_.bind(this.hasGroup, this);
        this.$rootScope.hasRoles = <any>_.bind(this.hasAnyGroup, this);
        this.$rootScope.can = <any>_.bind(this.can, this);

        const saveRoute = (storeKey: string) =>
            (e: IAngularEvent, route: IState, params: any) => {
                if ( this._isAllowedRoute(route) ) {
                    store.put(storeKey, {name: route.name, params: params});
                }
            };

        $rootScope.$on('$stateChangeSuccess', saveRoute('lastSuccessRoute'));
        $rootScope.$on('$stateChangePermissionDenied', saveRoute('lastFailedRoute'));

        this._syncSessionBetweenTabs();
        this._defineRoles();

        this._waitLoginDeferred = this.$q.defer();
    }

    public init() {
        this._loadUserDeferred = this.$q.defer();
        this.$authApi.getCurrentUser()
            .then(
                (u: ICurrentUser) => this._setCurrentUser(u),
                () => this._setCurrentUser(undefined)
            );
    }

    public waitLogin() {
        return this._waitLoginDeferred.promise;
    }

    public getCurrentUser() {
        return this._loadUserDeferred.promise;
    }

    public login(login: string, password: string) {
        this._loadUserDeferred = this.$q.defer();
        return this.$authApi.login(login, password)
            .then((u: ICurrentUser) => {
                this._setCurrentUser(u);
                this.$rootScope.$broadcast('user:signin');
                return u;
            });
    }

    public logout() {
        let deferred = this.$q.defer();
        deferred.reject();
        this._loadUserDeferred = deferred;

        return this.$authApi.logout()
            .then(() => this._setCurrentUser(undefined))
            .then(() => this.$rootScope.$broadcast('user:signout'));
    }

    public hasGroup(group: string) {
        return this._currentUser && _.includes(this._currentUser.groups, group);
    }

    public hasAnyGroup(groups: string[]) {
        return _.some(groups, r => this.hasGroup(r));
    }

    public can(right: string) {
        return _.has(this.acl, right) && this.hasAnyGroup(this.acl[right]);
    }

    public isRouteAllowed(state: string) {
        return this.getCurrentUser().then(user => {
            let route = this.$state.get(state);
            if ( !route ) {
                return false;
            }
            let permissions = _.cloneDeep(_.get<IStatePermissions>(route, 'data.permissions'));
            if ( !permissions ) {
                return true;
            }
            _.defaults(permissions, {
                except: [],
                only: []
            });
            let onlyAllowed = _.intersection(permissions.only, user.groups).length > 0;
            if ( onlyAllowed ) {
                return true;
            }
            return !_.isEmpty(permissions.except) &&
                _.isEmpty(_.intersection(permissions.except, user.groups));
        });
    }

    private _isAllowedRoute(route: IState) {
        var excludeRoutes = [this.loginRoute.name, this.logoutRoute.name];
        return !_.includes(excludeRoutes, route.name);
    }

    private _go(routeName: string, params?: any) {
        if ( this._isAllowedRoute({name: routeName}) ) {
            this.$state.go(routeName, params);
        }
    }

    private _doAfterSignin(user?: ICurrentUser) {
        this._loadUserDeferred.resolve(user);
        this._waitLoginDeferred.resolve(user);
        this._loadUserDeferred = this.$q.defer();
        this._loadUserDeferred.resolve(user);

        if ( user ) {
            this.store.put('user', user);
        }
        this._openLastPage();
    }

    private _openLastPage() {
        let go = (storeKey: string)=> {
            let route = this.store.get<IState>(storeKey);
            if ( route && this.$state.get(route.name) ) {
                this._go(route.name, route.params);
                return true;
            }
            return false;
        };

        if ( go('lastFailedRoute') ) {
            return;
        }

        if ( go('lastSuccessRoute') ) {
            return;
        }

        if ( this.homeRoute.force ) {
            this._go(this.homeRoute.name);
        }
    }

    private _doAfterSignout() {
        this._loadUserDeferred.reject();
        this._loadUserDeferred = this.$q.defer();
        this._loadUserDeferred.reject();

        this.store.remove('user');
        if ( this.loginRoute.force ) {
            this.$state.go(this.loginRoute.name);
        }
    }

    private _setCurrentUser(user: ICurrentUser) {
        this._currentUser = user;
        this.$rootScope.user = user;
        if ( user ) {
            this._doAfterSignin(user);
        } else {
            this._doAfterSignout();
        }
        return user;
    }

    private _defineRoles() {
        let guestChecker = () => this.getCurrentUser().then(() => this.$q.reject(), () => this.$q.resolve());
        this.RoleStore.defineRole('anonymous', [], guestChecker);

        _.forEach(this.userGroups, role => {
            let checker = () => this.getCurrentUser().then(() => this.hasGroup(role));
            this.RoleStore.defineRole(role, [], checker);
        });
    }

    private _syncSessionBetweenTabs(): void {
        let signinEvent = 'user:signin';
        let signoutEvent = 'user:signout';

        _.forEach([signinEvent, signoutEvent], e => {
            this.$rootScope.$on(e, () => this.$tabEvents.emit(e));
        });

        // Если сессия протухла, выходим из этой и всех прочих вкладок
        this.$rootScope.$on('api:invalidToken', () => {
            this._doAfterSignout();
            this.$tabEvents.emit(signoutEvent);
        });

        this.$tabEvents
            .on(signinEvent, () => {
                this._doAfterSignin();
                this._openLastPage();
            })
            .on(signoutEvent, () => {
                this._doAfterSignout();
            });
    }
}
