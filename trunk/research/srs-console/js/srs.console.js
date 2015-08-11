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

scApp.controller("CSCMain", ["$scope", "$interval", function($scope, $interval){
    $scope.logs = [];
    $scope.$on("$sc_system_error", function(event, status, response){
        // TODO: FIXME: parse the error.
        var log = {
            level:"warn", msg:response, create:new Date().getTime()
        };
        $scope.logs.push(log);
    });
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
}]);

scApp.controller("CSCSummary", ["$scope", "MSCSummary", function($scope, MSCSummary){
    MSCSummary.summaries_get(function(data){
        $scope.server = data.data.self;
    });
}]);

scApp.filter("sc_filter_log_level", function(){
    return function(v) {
        return v == "warn"? "alert-warn":"alert-success";
    };
});

scApp.factory("MSCSummary", ["$resource", function($resource){
    return $resource("/api/v1/summaries", {}, {
        summaries_get: {method:"GET"}
    });
}]);

scApp.provider("$sc_system_error", function(){
    this.$get = ["$window", "$rootScope", function($window, $rootScope){
        return function(status, response) {
            $rootScope.$broadcast("$sc_system_error", status, response);
        };
    }];
});
scApp.factory('MHttpInterceptor', function($q, $sc_system_error){
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
                $sc_system_error(response.status, response.data);
                // the $q.reject, will cause the error function of controller.
                // @see: https://code.angularjs.org/1.2.0-rc.3/docs/api/ng.$q
                return $q.reject(response.data.code);
            }
            return response || $q.when(response);
        },
        'responseError': function(rejection) {
            code = $sc_system_error(rejection.status, rejection.data);
            return $q.reject(code);
        }
    };
});
