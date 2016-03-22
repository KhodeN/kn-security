/// <reference path="./kn-security.d.ts" />

import 'lodashExt';

export class SecurityService implements KN.ISecurityService {
    private _currentUser: KN.ICurrentUser;
    private _loadUserDeferred: ng.IDeferred<KN.ICurrentUser>;
    private _waitLoginDeferred: ng.IDeferred<KN.ICurrentUser>;

    public static $inject = [
        '$rootScope',
        '$q',
        '$authApi',
        'store',
        'RoleStore',
        'userGroups',
        '$state',
        '$tabEvents',
        'acl'
    ];

    constructor(private $rootScope: KN.IRootScope,
                private $q: ng.IQService,
                private $authApi: KN.IAuthApiService,
                private store: ng.ICacheObject,
                /* tslint:disable:variable-name */
                private RoleStore: ng.permission.IRoleStore,
                /* tslint:enable:variable-name */
                private userGroups: string[],
                private $state: ng.ui.IStateService,
                private $tabEvents: KN.ITabEvents,
                private acl: any) {
        this.$rootScope.hasRole = <any>_.bind(this.hasGroup, this);
        this.$rootScope.hasRoles = <any>_.bind(this.hasAnyGroup, this);
        this.$rootScope.can = <any>_.bind(this.can, this);

        $rootScope.$on('$stateChangePermissionDenied', (e, route) => {
            store.put('lastFailedRoute', _.pick(route, ['name', 'params']));
        });

        this._syncSessionBetweenTabs();
        this._defineRoles();

        this._waitLoginDeferred = this.$q.defer();
    }

    public init() {
        this._loadUserDeferred = this.$q.defer();
        this.$authApi.getCurrentUser()
            .then(
                (u: KN.ICurrentUser) => this._setCurrentUser(u),
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
            .then((u: KN.ICurrentUser) => {
                this._setCurrentUser(u);
                this.$rootScope.$broadcast('user:signin');
                this._openLastPage();
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
            let permissions = _.cloneDeep(_.get<ng.permission.IStatePermissions>(route, 'data.permissions'));
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

    private _doAfterSignin(user?: KN.ICurrentUser) {
        this._loadUserDeferred.resolve(user);
        this._waitLoginDeferred.resolve(user);
        this._loadUserDeferred = this.$q.defer();
        this._loadUserDeferred.resolve(user);

        if ( user ) {
            this.store.put('user', user);
        }
    }

    private _openLastPage() {
        let route = this.store.get<ng.ui.IState>('lastFailedRoute');
        if ( route ) {
            this.store.remove('lastFailedRoute');
            this.$state.go(route.name, route.params);
        } else {
            this.$state.go('app.home');
        }
    }

    private _doAfterSignout() {
        this._loadUserDeferred.reject();
        this._loadUserDeferred = this.$q.defer();
        this._loadUserDeferred.reject();

        this.store.remove('user');
        this.$state.go('auth.login');
    }

    private _setCurrentUser(user: KN.ICurrentUser) {
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
