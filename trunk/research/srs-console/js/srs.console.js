var scApp = angular.module("scApp", ["ngRoute", "bravoUiAlert"]);

scApp.config(["$routeProvider", function($routeProvider){
    $routeProvider.otherwise({redirectTo:"/summaries"})
        .when("/summaries", {templateUrl:"views/summary.html", controller:"CSCSummary"});
}]);

scApp.controller("CSCMain", ["$scope", function($scope){
    $scope.logs = [];
}]);

scApp.controller("CSCSummary", ["$scope", function($scope){
    $scope.logs.push({code: 101, level:"warn", msg:"Summary fake error."});
}]);

scApp.filter("sc_filter_log_level", function(){
    return function(v) {
        return v == "warn"? "alert-warn":"alert-success";
    };
});
