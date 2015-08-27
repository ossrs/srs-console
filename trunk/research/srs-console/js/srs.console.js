var scApp = angular.module("scApp", ["ngRoute", "ngResource",
    "bravoUiAlert", "bravoUiPopover"
]);

scApp.config(["$routeProvider", function($routeProvider){
    $routeProvider.otherwise({redirectTo:"/connect"})
        .when("/connect", {templateUrl:"views/connect.html", controller:"CSCConnect"})
        .when("/vhosts", {templateUrl:"views/vhosts.html", controller:"CSCVhosts"})
        .when("/vhosts/:id", {templateUrl:"views/vhost.html", controller:"CSCVhost"})
        .when("/streams", {templateUrl:"views/streams.html", controller:"CSCStreams"})
        .when("/streams/:id", {templateUrl:"views/stream.html", controller:"CSCStream"})
        .when("/clients", {templateUrl:"views/clients.html", controller:"CSCClients"})
        .when("/clients/:id", {templateUrl:"views/client.html", controller:"CSCClient"})
        .when("/configs", {templateUrl:"views/configs.html", controller:"CSCConfigs"})
        .when("/summaries", {templateUrl:"views/summary.html", controller:"CSCSummary"});
}]);

scApp.controller("CSCMain", ["$scope", "$interval", "$location", "$sc_utility", "$sc_server", function($scope, $interval, $location, $sc_utility, $sc_server){
    $scope.logs = [];
    // remove expired alert.
    $interval(function(){
        for (var i = 0; i < $scope.logs.length; i++) {
            var log = $scope.logs[i];
            if (log.create + 10000 < new Date().getTime()) {
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

    $sc_utility.refresh.stop();
}]);

scApp.controller("CSCSummary", ["$scope", "MSCApi", "$sc_utility", "$sc_nav", function($scope, MSCApi, $sc_utility, $sc_nav){
    $sc_nav.in_summary();

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.summaries_get(function(data){
            $scope.server = data.data.self;
            $scope.system = data.data.system;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve summary from SRS.");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCVhosts", ["$scope", "MSCApi", "$sc_nav", "$sc_utility", function($scope, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_vhosts();

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.vhosts_get(function(data){
            $scope.vhosts = data.vhosts;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve vhosts from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCVhost", ["$scope", "$routeParams", "MSCApi", "$sc_nav", "$sc_utility", function($scope, $routeParams, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_vhosts();

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.vhosts_get2($routeParams.id, function(data){
            $scope.vhost = data.vhost;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve vhost info from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCStreams", ["$scope", "MSCApi", "$sc_nav", "$sc_utility", function($scope, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_streams();

    $scope.kickoff = function(stream) {
        MSCApi.clients_delete(stream.publish.cid, function(){
            $sc_utility.log("warn", "Kickoff stream ok.");
        });
    };

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.streams_get(function(data){
            $scope.streams = data.streams;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve streams from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCStream", ["$scope", "$routeParams", "MSCApi", "$sc_nav", "$sc_utility", function($scope, $routeParams, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_streams();

    $scope.kickoff = function(stream) {
        MSCApi.clients_delete(stream.publish.cid, function(){
            $sc_utility.log("warn", "Kickoff stream ok.");
        });
    };

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.streams_get2($routeParams.id, function(data){
            $scope.stream = data.stream;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve stream info from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCClients", ["$scope", "MSCApi", "$sc_nav", "$sc_utility", function($scope, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_clients();

    $scope.kickoff = function(client) {
        MSCApi.clients_delete(client.id, function(){
            $sc_utility.log("warn", "Kickoff client ok.");
        });
    };

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.clients_get(function(data){
            $scope.clients = data.clients;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve clients from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCClient", ["$scope", "$routeParams", "MSCApi", "$sc_nav", "$sc_utility", function($scope, $routeParams, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_clients();

    $scope.kickoff = function(client) {
        MSCApi.clients_delete(client.id, function(){
            $sc_utility.log("warn", "Kickoff client ok.");
        });
    };

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.clients_get2($routeParams.id, function(data){
            $scope.client = data.client;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve client info from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.controller("CSCConfigs", ["$scope", "MSCApi", "$sc_nav", "$sc_utility", function($scope, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_configs();

    $sc_utility.refresh.refresh_change(function(){
        MSCApi.configs_get(function(data){
            var global = data.global;
            for (var key in global.vhosts) {
                var vhost = global.vhosts[key];
                vhost.name = key;
            }
            $scope.global = global;

            $sc_utility.refresh.request();
        });
    }, 3000);

    $sc_utility.log("trace", "Retrieve config info from SRS");
    $sc_utility.refresh.request(0);
}]);

scApp.factory("MSCApi", ["$http", "$sc_server", function($http, $sc_server){
    return {
        versions_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/versions")).success(success);
        },
        summaries_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/summaries")).success(success);
        },
        vhosts_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/vhosts")).success(success);
        },
        vhosts_get2: function(id, success) {
            $http.jsonp($sc_server.jsonp("/api/v1/vhosts/" + id)).success(success);
        },
        streams_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/streams")).success(success);
        },
        streams_get2: function(id, success) {
            $http.jsonp($sc_server.jsonp("/api/v1/streams/" + id)).success(success);
        },
        clients_get: function(success) {
            $http.jsonp($sc_server.jsonp("/api/v1/clients")).success(success);
        },
        clients_get2: function(id, success) {
            $http.jsonp($sc_server.jsonp("/api/v1/clients/" + id)).success(success);
        },
        clients_delete: function(id, success) {
            $http.jsonp($sc_server.jsonp_delete("/api/v1/clients/" + id)).success(success);
        },
        configs_get: function(success) {
            $http.jsonp($sc_server.jsonp_query("/api/v1/raw", "rpc=config_query&scope=global")).success(success);
        }
    };
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

scApp.filter("sc_filter_filesize_k", function(){
    return function(v){
        // PB
        if (v > 1024 * 1024 * 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024 / 1024 / 1024).toFixed(2) + "PB";
        }
        // TB
        if (v > 1024 * 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024 / 1024).toFixed(2) + "TB";
        }
        // GB
        if (v > 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024).toFixed(2) + "GB";
        }
        // MB
        if (v > 1024 * 1024) {
            return Number(v / 1024.0 / 1024).toFixed(2) + "MB";
        }
        return v + "KB";
    };
});

scApp.filter("sc_filter_filerate_k", function(){
    return function(v){
        // PB
        if (v > 1024 * 1024 * 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024 / 1024 / 1024).toFixed(2) + "PBps";
        }
        // TB
        if (v > 1024 * 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024 / 1024).toFixed(2) + "TBps";
        }
        // GB
        if (v > 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024).toFixed(2) + "GBps";
        }
        // MB
        if (v > 1024 * 1024) {
            return Number(v / 1024.0 / 1024).toFixed(2) + "MBps";
        }
        return v + "KBps";
    };
});

scApp.filter("sc_filter_bitrate_k", function(){
    return function(v){
        // PB
        if (v > 1000 * 1000 * 1000 * 1000 * 1000) {
            return Number(v / 1000.0 / 1000 / 1000 / 1000 / 1000).toFixed(2) + "Pbps";
        }
        // TB
        if (v > 1000 * 1000 * 1000 * 1000) {
            return Number(v / 1000.0 / 1000 / 1000 / 1000).toFixed(2) + "Tbps";
        }
        // GB
        if (v > 1000 * 1000 * 1000) {
            return Number(v / 1000.0 / 1000 / 1000).toFixed(2) + "Gbps";
        }
        // MB
        if (v > 1000 * 1000) {
            return Number(v / 1000.0 / 1000).toFixed(2) + "Mbps";
        }
        return v + "Kbps";
    };
});

scApp.filter("sc_filter_percent", function(){
    return function(v){
        return Number(v).toFixed(2) + "%";
    };
});

scApp.filter("sc_filter_enabled", function(){
    return function(v){
        return v? "开启":"关闭";
    };
});

scApp.filter("sc_filter_yesno", function(){
    return function(v){
        return v? "是":"否";
    };
});

scApp.filter("sc_filter_yn", function(){
    return function(v){
        return v? "Y":"N";
    };
});

scApp.filter("sc_filter_has_stream", function(){
    return function(v){
        return v? "有流":"无流";
    };
});

scApp.filter("sc_filter_video", function(){
    return function(v){
        return v? v.codec + "/" + v.profile + "/" + v.level : "无视频";
    };
});

scApp.filter("sc_filter_audio", function(){
    return function(v){
        return v? v.codec + "/" + v.sample_rate + "/" + (v.channel == 2? "Stereo":"Mono") + "/" + v.profile : "无音频";
    };
});

scApp.filter("sc_filter_number", function(){
    return function(v){
        return Number(v).toFixed(2);
    };
});

scApp.filter("sc_filter_time", function(){
    return function(v){
        var s = "";
        if (v > 3600 * 24) {
            s = Number(v / 3600 / 24).toFixed(0) + "天 ";
            v = v % (3600 * 24);
        }
        s += relative_seconds_to_HHMMSS(v);
        return s;
    };
});

scApp.filter("sc_filter_ctype", function(){
    return function(v){
        return v? "推流":"播放";
    };
});

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
            in_vhosts: function(){
                this.selected = "/vhosts";
            },
            in_streams: function(){
                this.selected = "/streams";
            },
            in_clients: function(){
                this.selected = "/clients";
            },
            in_configs: function(){
                this.selected = "/configs";
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
            jsonp_delete: function(url) {
                return this.jsonp(url) + "&method=DELETE";
            },
            jsonp_query: function(url, query){
                return this.baseurl() + url + "?callback=JSON_CALLBACK&" + query;
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
            },
            refresh: async_refresh2
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
