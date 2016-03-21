/// <reference path="./kn-security.d.ts" />

export class TabEventsService implements KN.ITabEvents {
    private _storageHandlers: {
        [key: string]: Array<() => void>;
    };

    public static $inject = ['$window'];

    constructor(private $window: ng.IWindowService) {
        this._storageHandlers = {};
        this.$window.addEventListener('storage', (e: StorageEvent) => {
            _.forEach(this._storageHandlers[e.key], h => h());
        });
    }

    public on(key: string, cb: () => void) {
        let handlers = this._storageHandlers[key] || [];
        handlers.push(cb);
        this._storageHandlers[key] = handlers;
        return this;
    }

    public emit(key: string) {
        let currentValue = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, (currentValue + 1).toString());
        return this;
    }
}
