import { SecurityService } from './$security';
import { TabEventsService } from './$tabEvents';
import 'angular';
import 'ui.router';
import 'angular-cache';

var moduleName = 'kn-security';
var dependencies = [
    'ui.router',
    'permission',
    'angular-cache'
];
angular.module(moduleName, dependencies)
    .value('forceHomeRoute', 'app.home')
    .value('forceLoginRoute', 'auth.login')
    .config([
        'CacheFactoryProvider',
        (CacheFactoryProvider: ng.cache.ICacheFactoryProvider) => {
            angular.extend(CacheFactoryProvider.defaults, {
                // maxAge: 15 * 60 * 1000,
                storageMode: 'localStorage'
            });
        }
    ])
    /* tslint:disable:variable-name */
    .factory('cacheGenerator', [
        'CacheFactory',
        (CacheFactory: ng.cache.ICacheFactory) => {
            /* tslint:enable:variable-name */
            return (cacheName: string, options?: any) => {
                if ( !CacheFactory.get(cacheName) ) {
                    options = options || {storageMode: 'localStorage'};
                    CacheFactory.createCache(cacheName, options);
                }
                return CacheFactory.get(cacheName);
            };
        }
    ])
    .factory('store', [
        'cacheGenerator',
        (cacheGenerator: (name: string) => any) => {
            return cacheGenerator('store');
        }
    ])
    .service({
        $security: SecurityService,
        $tabEvents: TabEventsService
    });

export default moduleName;
