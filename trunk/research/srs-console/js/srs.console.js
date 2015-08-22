var scApp = angular.module("scApp", ["ngRoute", "ngResource",
    "bravoUiAlert", "bravoUiPopover"
]);

scApp.config(["$routeProvider", function($routeProvider){
    $routeProvider.otherwise({redirectTo:"/connect"})
        .when("/connect", {templateUrl:"views/connect.html", controller:"CSCConnect"})
        .when("/summaries", {templateUrl:"views/summary.html", controller:"CSCSummary"});
}]);

scApp.controller("CSCMain", ["$scope", "$interval", "$location", "$sc_utility", "$sc_server", function($scope, $interval, $location, $sc_utility, $sc_server){
    $scope.logs = [];
    // remove expired alert.
    $interval(function(){
        for (var i = 0; i < $scope.logs.length; i++) {
            var log = $scope.logs[i];
            if (log.create + 3000 < new Date().getTime()) {
                $scope.logs.splice(i, 1);
                break;
            }
        }
    }, 3000);
    // handler system log event, from $sc_log service.
    $scope.$on("$sc_utility_log", function(event, level, msg){
        var log = {
            level:level, msg:msg, create:new Date().getTime()
        };
        // only show 3 msgs.
        while ($scope.logs.length > 2) {
            $scope.logs.splice($scope.logs.length - 1, 1);
        }
        $scope.logs.push(log);
    });

    // handle system error event, from $sc_system_error service.
    $scope.$on("$sc_utility_http_error", function(event, status, response){
        // TODO: FIXME: parse the error.
        $sc_utility.log("warn", response);
    });

    $sc_server.init($location);
    //$sc_utility.log("trace", "set baseurl to " + $sc_server.baseurl());
}]);

scApp.controller("CSCConnect", ["$scope", "$location", "MSCApi", "$sc_utility", "$sc_nav", "$sc_server", function($scope, $location, MSCApi, $sc_utility, $sc_nav, $sc_server){
    $sc_nav.in_control();
    $scope.server = {
        ip: $sc_server.host,
        port: $sc_server.port
    };
    $scope.connect = function(){
        $sc_server.host = $scope.server.ip;
        $sc_server.port = $scope.server.port;

        MSCApi.versions_get(function(data){
            $sc_utility.log("trace", "连接到SRS" + $scope.server.ip + "成功, SRS/" + data.data.version);
            $sc_nav.go_summary($location);
        });
    };
}]);
scApp.controller("CSCSummary", ["$scope", "MSCApi", "$sc_utility", "$sc_nav", function($scope, MSCApi, $sc_utility, $sc_nav){
    $sc_nav.in_summary();

    MSCApi.summaries_get(function(data){
        $sc_utility.log("trace", "Retrieve summary from SRS ok.");
        $scope.server = data.data.self;
    });
}]);

scApp.filter("sc_filter_log_level", function(){
    return function(v) {
        return (v == "warn" || v == "error")? "alert-warn":"alert-success";
    };
});

scApp.filter("sc_filter_nav_active", ["$sc_nav", function($sc_nav){
    return function(v){
        return $sc_nav.is_selected(v)? "active":"";
    };
}]);

scApp.factory("MSCApi", ["$http", "$sc_server", function($http, $sc_server){
    return {
        versions_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/versions")).success(success);
        },
        summaries_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/summaries")).success(success);
        }
    };
}]);

// the sc nav is the nevigator
scApp.provider("$sc_nav", function(){
    this.$get = function(){
        return {
            selected: null,
            in_control: function(){
                this.selected = "/console";
            },
            in_summary: function(){
                this.selected = "/summaries";
            },
            go_summary: function($location){
                $location.path("/summaries");
            },
            is_selected: function(v){
                return v == this.selected;
            }
        };
    };
});

// the sc server is the server we connected to.
scApp.provider("$sc_server", function(){
    this.$get = function(){
        return {
            schema: "http",
            host: null,
            port: 1985,
            baseurl: function(){
                return this.schema + "://" + this.host + (this.port == 80? "": ":" + this.port);
            },
            jsonp: function(url){
                return this.baseurl() + url + "?callback=JSON_CALLBACK";
            },
            init: function($location) {
                this.host = $location.host();
                this.port = $location.port();
            }
        };
    };
});

// the sc utility is a set of helper utilities.
scApp.provider("$sc_utility", function(){
    this.$get = ["$rootScope", function($rootScope){
        return {
            log: function(level, msg) {
                $rootScope.$broadcast("$sc_utility_log", level, msg);
            },
            http_error: function(status, response) {
                $rootScope.$broadcast("$sc_utility_http_error", status, response);
            }
        };
    }];
});

// config the http interceptor.
scApp.config(['$httpProvider', function($httpProvider){
    $httpProvider.interceptors.push('MHttpInterceptor');
}]);

// the http interceptor.
scApp.factory('MHttpInterceptor', ["$q", "$sc_utility", function($q, $sc_utility){
    // register the interceptor as a service
    // @see: https://code.angularjs.org/1.2.0-rc.3/docs/api/ng.$http
    // @remark: the function($q) should never add other params.
    return {
        'request': function(config) {
            return config || $q.when(config);
        },
        'requestError': function(rejection) {
            return $q.reject(rejection);
        },
        'response': function(response) {
            if (response.data.code && response.data.code != 0) {
                $sc_utility.http_error(response.status, response.data);
                // the $q.reject, will cause the error function of controller.
                // @see: https://code.angularjs.org/1.2.0-rc.3/docs/api/ng.$q
                return $q.reject(response.data.code);
            }
            return response || $q.when(response);
        },
        'responseError': function(rejection) {
            code = $sc_utility.http_error(rejection.status, rejection.data);
            return $q.reject(code);
        }
    };
}]);
