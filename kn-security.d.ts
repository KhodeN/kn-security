declare namespace KN {
    interface ICurrentUser {
        groups: string[];
        rights: string[];
    }

    interface IAuthApiService<T extends ICurrentUser> {
        getCurrentUser<T>(): ng.IPromise<T>;
        login<T>(login: string, password: string): ng.IPromise<T>;
        logout(): ng.IPromise<any>;
    }

    interface IRootScope extends ng.IRootScopeService {
        user: ICurrentUser;
        hasRole(role: string): boolean;
        hasRoles(roles: string[]): boolean;
        can(right: string): boolean;
    }

    interface ISecurityService {
        init(): void;
        getCurrentUser(): ng.IPromise<ICurrentUser>;
        login(login: string, password: string): ng.IPromise<ICurrentUser>;
        logout(): ng.IPromise<any>;
        hasGroup(group: string): boolean;
        hasAnyGroup(groups: string[]): boolean;
        can(right: string): boolean;
        waitLogin(): ng.IPromise<ICurrentUser>;
        isRouteAllowed(route: string): ng.IPromise<boolean>;
    }

    interface ITabEvents {
        on(event: string, cb: () => void): ITabEvents;
        emit(event: string): ITabEvents;
    }

    interface IRoute {
        name: string;
        force: boolean;
    }
}
