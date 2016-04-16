"use strict";
require('lodash-ext');
var SecurityService = (function () {
    function SecurityService($rootScope, $q, $authApi, store, RoleStore, userGroups, $state, $tabEvents, homeRoute, loginRoute, logoutRoute, acl) {
        var _this = this;
        this.$rootScope = $rootScope;
        this.$q = $q;
        this.$authApi = $authApi;
        this.store = store;
        this.RoleStore = RoleStore;
        this.userGroups = userGroups;
        this.$state = $state;
        this.$tabEvents = $tabEvents;
        this.homeRoute = homeRoute;
        this.loginRoute = loginRoute;
        this.logoutRoute = logoutRoute;
        this.acl = acl;
        this.$rootScope.hasRole = _.bind(this.hasGroup, this);
        this.$rootScope.hasRoles = _.bind(this.hasAnyGroup, this);
        this.$rootScope.can = _.bind(this.can, this);
        var saveRoute = function (storeKey) {
            return function (e, route, params) {
                if (_this._isAllowedRoute(route)) {
                    store.put(storeKey, { name: route.name, params: params });
                }
            };
        };
        $rootScope.$on('$stateChangeSuccess', saveRoute('lastSuccessRoute'));
        $rootScope.$on('$stateChangePermissionDenied', saveRoute('lastFailedRoute'));
        this._syncSessionBetweenTabs();
        this._defineRoles();
        this._waitLoginDeferred = this.$q.defer();
    }
    SecurityService.prototype.init = function () {
        var _this = this;
        this._loadUserDeferred = this.$q.defer();
        this.$authApi.getCurrentUser()
            .then(function (u) { return _this._setCurrentUser(u); }, function () { return _this._setCurrentUser(undefined); });
    };
    SecurityService.prototype.waitLogin = function () {
        return this._waitLoginDeferred.promise;
    };
    SecurityService.prototype.getCurrentUser = function () {
        return this._loadUserDeferred.promise;
    };
    SecurityService.prototype.login = function (login, password) {
        var _this = this;
        this._loadUserDeferred = this.$q.defer();
        return this.$authApi.login(login, password)
            .then(function (u) {
            _this._setCurrentUser(u);
            _this.$rootScope.$broadcast('user:signin');
            return u;
        });
    };
    SecurityService.prototype.logout = function () {
        var _this = this;
        var deferred = this.$q.defer();
        deferred.reject();
        this._loadUserDeferred = deferred;
        return this.$authApi.logout()
            .then(function () { return _this._setCurrentUser(undefined); })
            .then(function () { return _this.$rootScope.$broadcast('user:signout'); });
    };
    SecurityService.prototype.hasGroup = function (group) {
        return this._currentUser && _.includes(this._currentUser.groups, group);
    };
    SecurityService.prototype.hasAnyGroup = function (groups) {
        var _this = this;
        return _.some(groups, function (r) { return _this.hasGroup(r); });
    };
    SecurityService.prototype.can = function (right) {
        return _.has(this.acl, right) && this.hasAnyGroup(this.acl[right]);
    };
    SecurityService.prototype.isRouteAllowed = function (state) {
        var _this = this;
        return this.getCurrentUser().then(function (user) {
            var route = _this.$state.get(state);
            if (!route) {
                return false;
            }
            var permissions = _.cloneDeep(_.get(route, 'data.permissions'));
            if (!permissions) {
                return true;
            }
            _.defaults(permissions, {
                except: [],
                only: []
            });
            var onlyAllowed = _.intersection(permissions.only, user.groups).length > 0;
            if (onlyAllowed) {
                return true;
            }
            return !_.isEmpty(permissions.except) &&
                _.isEmpty(_.intersection(permissions.except, user.groups));
        });
    };
    SecurityService.prototype._isAllowedRoute = function (route) {
        var excludeRoutes = [this.loginRoute.name, this.logoutRoute.name];
        return !_.includes(excludeRoutes, route.name);
    };
    SecurityService.prototype._go = function (routeName, params) {
        if (this._isAllowedRoute({ name: routeName })) {
            this.$state.go(routeName, params);
        }
    };
    SecurityService.prototype._doAfterSignin = function (user) {
        this._loadUserDeferred.resolve(user);
        this._waitLoginDeferred.resolve(user);
        this._loadUserDeferred = this.$q.defer();
        this._loadUserDeferred.resolve(user);
        if (user) {
            this.store.put('user', user);
        }
        this._openLastPage();
    };
    SecurityService.prototype._openLastPage = function () {
        var _this = this;
        var go = function (storeKey) {
            var route = _this.store.get(storeKey);
            if (route && _this.$state.get(route.name)) {
                _this._go(route.name, route.params);
                return true;
            }
            return false;
        };
        if (go('lastFailedRoute')) {
            return;
        }
        if (go('lastSuccessRoute')) {
            return;
        }
        if (this.homeRoute.force) {
            this._go(this.homeRoute.name);
        }
    };
    SecurityService.prototype._doAfterSignout = function () {
        this._loadUserDeferred.reject();
        this._loadUserDeferred = this.$q.defer();
        this._loadUserDeferred.reject();
        this.store.remove('user');
        if (this.loginRoute.force) {
            this._go(this.loginRoute.name);
        }
    };
    SecurityService.prototype._setCurrentUser = function (user) {
        this._currentUser = user;
        this.$rootScope.user = user;
        if (user) {
            this._doAfterSignin(user);
        }
        else {
            this._doAfterSignout();
        }
        return user;
    };
    SecurityService.prototype._defineRoles = function () {
        var _this = this;
        var guestChecker = function () { return _this.getCurrentUser().then(function () { return _this.$q.reject(); }, function () { return _this.$q.resolve(); }); };
        this.RoleStore.defineRole('anonymous', [], guestChecker);
        _.forEach(this.userGroups, function (role) {
            var checker = function () { return _this.getCurrentUser().then(function () { return _this.hasGroup(role); }); };
            _this.RoleStore.defineRole(role, [], checker);
        });
    };
    SecurityService.prototype._syncSessionBetweenTabs = function () {
        var _this = this;
        var signinEvent = 'user:signin';
        var signoutEvent = 'user:signout';
        _.forEach([signinEvent, signoutEvent], function (e) {
            _this.$rootScope.$on(e, function () { return _this.$tabEvents.emit(e); });
        });
        this.$rootScope.$on('api:invalidToken', function () {
            _this._doAfterSignout();
            _this.$tabEvents.emit(signoutEvent);
        });
        this.$tabEvents
            .on(signinEvent, function () {
            _this._doAfterSignin();
            _this._openLastPage();
        })
            .on(signoutEvent, function () {
            _this._doAfterSignout();
        });
    };
    SecurityService.$inject = [
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
    return SecurityService;
}());
exports.SecurityService = SecurityService;
