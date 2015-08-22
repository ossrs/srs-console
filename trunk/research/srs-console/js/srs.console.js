var scApp = angular.module("scApp", ["ngRoute", "ngResource",
    "bravoUiAlert", "bravoUiPopover"
]);

scApp.config(["$routeProvider", function($routeProvider){
    $routeProvider.otherwise({redirectTo:"/summaries"})
        .when("/summaries", {templateUrl:"views/summary.html", controller:"CSCSummary"});
}])
// config the http interceptor.
.config(['$httpProvider', function($httpProvider){
    $httpProvider.interceptors.push('MHttpInterceptor');
}]);

scApp.controller("CSCMain", ["$scope", "$interval", "$sc_utility", function($scope, $interval, $sc_utility){
    $scope.logs = [];
    // remove expired alert.
    $interval(function(){
        for (var i = 0; i < $scope.logs.length; i++) {
            var log = $scope.logs[i];
            if (log.create + 5000 < new Date().getTime()) {
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
        $scope.logs.push(log);
    });

    // handle system error event, from $sc_system_error service.
    $scope.$on("$sc_utility_http_error", function(event, status, response){
        // TODO: FIXME: parse the error.
        $sc_utility.log("warn", response);
    });
}]);

scApp.controller("CSCSummary", ["$scope", "MSCSummary", "$sc_utility", function($scope, MSCSummary, $sc_utility){
    MSCSummary.summaries_get(function(data){
        $sc_utility.log("trace", "Retrieve summary from SRS ok.")
        $scope.server = data.data.self;
    });
}]);

scApp.filter("sc_filter_log_level", function(){
    return function(v) {
        return (v == "warn" || v == "error")? "alert-warn":"alert-success";
    };
});

scApp.factory("MSCSummary", ["$resource", function($resource){
    return $resource("/api/v1/summaries", {}, {
        summaries_get: {method:"GET"}
    });
}]);

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
