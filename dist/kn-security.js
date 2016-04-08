"use strict";
var _security_1 = require('./$security');
var _tabEvents_1 = require('./$tabEvents');
require('angular');
require('ui.router');
require('angular-permission');
require('angular-cache');
var moduleName = 'kn-security';
var dependencies = [
    'ui.router',
    'permission',
    'angular-cache'
];
angular.module(moduleName, dependencies)
    .value('homeRoute', { name: 'app.home', force: false })
    .value('loginRoute', { name: 'auth.login', force: false })
    .value('logoutRoute', { name: 'auth.logout', force: false })
    .config([
    'CacheFactoryProvider',
    function (CacheFactoryProvider) {
        angular.extend(CacheFactoryProvider.defaults, {
            storageMode: 'localStorage'
        });
    }
])
    .factory('cacheGenerator', [
    'CacheFactory',
    function (CacheFactory) {
        return function (cacheName, options) {
            if (!CacheFactory.get(cacheName)) {
                options = options || { storageMode: 'localStorage' };
                CacheFactory.createCache(cacheName, options);
            }
            return CacheFactory.get(cacheName);
        };
    }
])
    .factory('store', [
    'cacheGenerator',
    function (cacheGenerator) {
        return cacheGenerator('store');
    }
])
    .service({
    $security: _security_1.SecurityService,
    $tabEvents: _tabEvents_1.TabEventsService
});
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = moduleName;
