(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports", './$security', './$tabEvents', 'angular', 'ui.router'], factory);
    }
})(function (require, exports) {
    "use strict";
    var _security_1 = require('./$security');
    var _tabEvents_1 = require('./$tabEvents');
    require('angular');
    require('ui.router');
    angular.module('kb-security', ['ui.router'])
        .config(function (CacheFactoryProvider) {
        angular.extend(CacheFactoryProvider.defaults, {
            storageMode: 'localStorage'
        });
    })
        .factory('cacheGenerator', function (CacheFactory) {
        return function (cacheName, options) {
            if (!CacheFactory.get(cacheName)) {
                options = options || { storageMode: 'localStorage' };
                CacheFactory.createCache(cacheName, options);
            }
            return CacheFactory.get(cacheName);
        };
    })
        .factory('store', function (cacheGenerator) { return cacheGenerator('store'); })
        .service({
        $security: _security_1.SecurityService,
        $tabEvents: _tabEvents_1.TabEventsService
    });
});
