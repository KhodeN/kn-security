import { SecurityService } from './$security';
import { TabEventsService } from './$tabEvents';
import 'angular';
import 'ui.router';

angular.module('kb-security', ['ui.router'])
    .config((CacheFactoryProvider: ng.cache.ICacheFactoryProvider) => {
        angular.extend(CacheFactoryProvider.defaults, {
            // maxAge: 15 * 60 * 1000,
            storageMode: 'localStorage'
        });                                    
    })
    /* tslint:disable:variable-name */
    .factory('cacheGenerator', (CacheFactory: ng.cache.ICacheFactory) => {
        /* tslint:enable:variable-name */
        return (cacheName: string, options?: any) => {
            if ( !CacheFactory.get(cacheName) ) {
                options = options || {storageMode: 'localStorage'};
                CacheFactory.createCache(cacheName, options);
            }
            return CacheFactory.get(cacheName);
        };
    })
    .factory('store', (cacheGenerator: (name: string) => any) => cacheGenerator('store'))
    .service({
        $security: SecurityService,
        $tabEvents: TabEventsService
    });
