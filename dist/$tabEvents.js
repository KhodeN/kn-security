(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    var TabEventsService = (function () {
        function TabEventsService($window) {
            var _this = this;
            this.$window = $window;
            this._storageHandlers = {};
            this.$window.addEventListener('storage', function (e) {
                _.forEach(_this._storageHandlers[e.key], function (h) { return h(); });
            });
        }
        TabEventsService.prototype.on = function (key, cb) {
            var handlers = this._storageHandlers[key] || [];
            handlers.push(cb);
            this._storageHandlers[key] = handlers;
            return this;
        };
        TabEventsService.prototype.emit = function (key) {
            var currentValue = parseInt(localStorage.getItem(key) || '0', 10);
            localStorage.setItem(key, (currentValue + 1).toString());
            return this;
        };
        TabEventsService.$inject = ['$window'];
        return TabEventsService;
    }());
    exports.TabEventsService = TabEventsService;
});
