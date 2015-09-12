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
        .when("/configs/:id", {templateUrl:"views/config.html", controller:"CSCConfig"})
        .when("/summaries", {templateUrl:"views/summary.html", controller:"CSCSummary"});
}]);

scApp.controller("CSCMain", ["$scope", "$interval", "$location", "MSCApi", "$sc_utility", "$sc_server", function($scope, $interval, $location, MSCApi, $sc_utility, $sc_server){
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
    // handler system log event, from $sc_utility service.
    $scope.$on("$sc_utility_log", function(event, level, msg){
        var log = {
            level:level, msg:msg, create:new Date().getTime()
        };
        // only show 3 msgs.
        while ($scope.logs.length > 2) {
            $scope.logs.splice(0, 1);
        }
        $scope.logs.push(log);
    });

    // handle system error event, from $sc_utility service.
    $scope.$on("$sc_utility_http_error", function(event, status, response){
        if (status != 200) {
            if (!status && !response) {
                response = "无法访问服务器";
            } else {
                response = "HTTP/" + status + ", " + response;
            }
        } else {
            var map = {
                1062: "服务器不允许这个操作",
                1063: "RawApi参数不符合要求"
            };
            if (map[response.code]) {
                response = "code=" + response.code + ", " + map[response.code];
            } else {
                resonse = "code=" + response.code + ", 系统错误";
            }
        }

        $sc_utility.log("warn", response);
    });

    // handle location events.
    $scope.$on("$locationChangeStart", function(){
        // we store the config in the query string url.
        // always set the host and port in query.
        if (!$location.search().host && $sc_server.host) {
            $location.search("host", $sc_server.host);
        }

        if (!$location.search().port && $sc_server.port) {
            $location.search("port", $sc_server.port);
        }
    });

    // reset the config.
    $scope.reset = function(){
        $sc_server.host = $location.host();
        $sc_server.port = 1985;

        $location.search("host", $sc_server.host);
        $location.search("port", $sc_server.port);

        $location.path("/connect")
    };

    // init the server and port for api.
    $sc_server.init($location, MSCApi);

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

    $sc_utility.refresh.stop();

    MSCApi.vhosts_get2($routeParams.id, function(data){
        $scope.vhost = data.vhost;
    });

    $sc_utility.log("trace", "Retrieve vhost info from SRS");
}]);

scApp.controller("CSCStreams", ["$scope", "MSCApi", "$sc_nav", "$sc_utility", function($scope, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_streams();

    $scope.kickoff = function(stream) {
        MSCApi.clients_delete(stream.publish.cid, function(){
            $sc_utility.log("warn", "Kickoff stream ok.");
        });
    };

    MSCApi.vhosts_get(function(data){
        var vhosts = data.vhosts;

        $sc_utility.refresh.refresh_change(function(){
            MSCApi.streams_get(function(data){
                for (var k in data.streams) {
                    var stream = data.streams[k];
                    stream.owner = system_array_get(vhosts, function(vhost) {return vhost.id == stream.vhost; });
                }

                $scope.streams = data.streams;

                $sc_utility.refresh.request();
            });
        }, 3000);

        $sc_utility.log("trace", "Retrieve streams from SRS");
        $sc_utility.refresh.request(0);
    });

    $sc_utility.log("trace", "Retrieve vhost info from SRS");
}]);

scApp.controller("CSCStream", ["$scope", "$routeParams", "MSCApi", "$sc_nav", "$sc_utility", function($scope, $routeParams, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_streams();

    $scope.kickoff = function(stream) {
        MSCApi.clients_delete(stream.publish.cid, function(){
            $sc_utility.log("warn", "Kickoff stream ok.");
        });
    };

    $sc_utility.refresh.stop();

    MSCApi.streams_get2($routeParams.id, function(data){
        var stream = data.stream;
        if (!$scope.owner) {
            MSCApi.vhosts_get2(stream.vhost, function(data) {
                var vhost = data.vhost;

                stream.owner = $scope.owner = vhost;
                $scope.stream = stream;
            });
            $sc_utility.log("trace", "Retrieve vhost info from SRS");
        } else {
            stream.owner = $scope.owner;
            $scope.stream = stream;
        }
    });

    $sc_utility.log("trace", "Retrieve stream info from SRS");
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

    $sc_utility.refresh.stop();

    MSCApi.clients_get2($routeParams.id, function(data){
        $scope.client = data.client;
    });

    $sc_utility.log("trace", "Retrieve client info from SRS");
}]);

scApp.controller("CSCConfigs", ["$scope", "$location", "MSCApi", "$sc_nav", "$sc_utility", "$sc_server", function($scope, $location, MSCApi, $sc_nav, $sc_utility, $sc_server){
    $sc_nav.in_configs();

    $sc_utility.refresh.stop();

    $scope.support_raw_api = false;

    MSCApi.configs_raw(function(data){
        $scope.http_api = data.http_api;
        if (!data.http_api || !data.http_api.enabled || !data.http_api.raw_api || !data.http_api.raw_api.enabled) {
            $scope.warn_raw_api = $sc_utility.const_raw_api_not_supported;
            return;
        }

        MSCApi.configs_get(function(data){
            /**
             * transform the api data to angularjs perfer, for instance:
                     data.global.listen = ["1935, "1936"];
                     data.global.http_api.listen = "1985";
             * parsed to:
                     global.listen = {
                        key: 'listen',
                        value: ["1935", "1936"],
                        error: false
                     }
                     global.http_api.listen = {
                        key: 'http_api.listen',
                        value: "1985",
                        error: false
                     }
             * where the error is used for commit error.
             */
            var object2complex = function(complex, obj, prefix) {
                for (var k in obj) {
                    var v = obj[k];
                    var key = prefix? prefix + "." + k : k;

                    if (key == "vhosts") {
                        complex[k] = v;
                        continue;
                    }

                    if (typeof v == "object" && v.constructor != Array) {
                        var cv = {};
                        complex[k] = cv;

                        object2complex(cv, v, key);
                        continue;
                    }

                    complex[k] = {
                        key: system_string_trim(key, 'global.'),
                        value: v,
                        error: false
                    };
                }
            };
            var global = {};
            //console.log(data.global);
            object2complex(global, data.global, null);
            //console.log(global);

            $scope.global = global;
            $scope.support_raw_api = true;
            //console.log(data);
        });
    }, function(data){
        $scope.warn_raw_api = $sc_utility.const_raw_api_not_supported;
    });

    $scope.submit = function(conf) {
        if (typeof conf.value != "boolean" && !conf.value) {
            $sc_utility.log("warn", "global." + conf.key + " should not be empty");
            return false;
        }

        var v = conf.value;
        if (conf.key == "listen") {
            if (!system_array_foreach(v, function(e){ return e; })) {
                $sc_utility.log("warn", "listen should not be empty");
                return false;
            }
        } else if (conf.key == "pid") {
            if (!system_string_startswith(v, ['./', '/var/', '/tmp/'])) {
                $sc_utility.log("warn", "pid should starts with ./, /var/ or /tmp/");
                return false;
            }
            if (!system_string_endswith(v, '.pid')) {
                $sc_utility.log("warn", "pid should be *.pid");
                return false;
            }
        } else if (conf.key == "chunk_size") {
            if (parseInt(v) < 128 || parseInt(v) > 65535) {
                $sc_utility.log("warn", "chunk_size should in [128, 65535], value=" + v);
                return false;
            }
        } else if (conf.key == "ff_log_dir") {
            if (v != '/dev/null' && !system_string_startswith(v, ['/var/', '/tmp/', './'])) {
                $sc_utility.log("warn", "ff_log_dir should be /dev/null or in ./, /var/ or /tmp/");
                return false;
            }
        } else if (conf.key == "srs_log_tank") {
            if (v != "file" && v != "console") {
                $sc_utility.log("warn", "srs_log_tank should be file or console");
                return false;
            }
        } else if (conf.key == "srs_log_level") {
            if (v != "verbose" && v != "info" && v != "trace" && v != "warn" && v != "error") {
                $sc_utility.log("warn", "srs_log_level should be verbose, info, trace, warn, error");
                return false;
            }
        } else if (conf.key == "srs_log_file") {
            if (!system_string_startswith(v, ['./', '/var/', '/tmp/'])) {
                $sc_utility.log("warn", "srs_log_file should be in ./, /var/ or /tmp/");
                return false;
            }
            if (!system_string_endswith(v, '.log')) {
                $sc_utility.log("warn", "srs_log_file should be *.log");
                return false;
            }
        } else if (conf.key == "max_connections") {
            if (parseInt(v) < 10 || parseInt(v) > 65535) {
                $sc_utility.log("warn", "max_connections should in [10, 65535], value=" + v);
                return false;
            }
        } else if (conf.key == "utc_time") {
            if (v == undefined) {
                $sc_utility.log("warn", "utc_time invalid");
                return false;
            }
        } else if (conf.key == "pithy_print_ms") {
            if (parseInt(v) < 100 || parseInt(v) > 300000) {
                $sc_utility.log("warn", "pithy_print_ms invalid");
                return false;
            }
        }

        // submit to server.
        $sc_utility.log("trace", "Submit to server ok, " + conf.key + "=" + conf.value);
        MSCApi.clients_update(conf.key, conf.value, function(data){
            $sc_utility.log("trace", "Server accepted, " + conf.key + "=" + conf.value);
            conf.error = false;

            // reload the rtmp service port when port changed.
            if (conf.key == "listen") {
                $sc_server.init($location, MSCApi);
            }
        }, function(){
            conf.error = true;
        });

        return true;
    };

    $sc_utility.log("trace", "Retrieve config info from SRS");
}]);

scApp.controller("CSCConfig", ["$scope", "$routeParams", "MSCApi", "$sc_nav", "$sc_utility", function($scope, $routeParams, MSCApi, $sc_nav, $sc_utility){
    $sc_nav.in_configs();

    $sc_utility.refresh.stop();

    MSCApi.configs_get2($routeParams.id, function(data){
        $scope.vhost = data.vhost;
    });

    $sc_utility.log("trace", "Retrieve vhost config info from SRS");
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
        configs_raw: function(success, error) {
            $http.jsonp($sc_server.jsonp_query("/api/v1/raw", "rpc=raw")).success(success).error(error);
        },
        configs_get: function(success) {
            $http.jsonp($sc_server.jsonp_query("/api/v1/raw", "rpc=query&scope=global")).success(success);
        },
        configs_get2: function(id, success) {
            $http.jsonp($sc_server.jsonp_query("/api/v1/raw", "rpc=query&scope=vhost&vhost=" + id)).success(success);
        },
        configs_get3: function(success) {
            $http.jsonp($sc_server.jsonp_query("/api/v1/raw", "rpc=query&scope=minimal")).success(success);
        },
        clients_update: function(scope, value, success, error) {
            $http.jsonp($sc_server.jsonp_query("/api/v1/raw", "rpc=update&scope=" + scope + "&value=" + value)).success(success).error(error);
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
        if (v > 1024 * 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024 / 1024).toFixed(2) + "PB";
        }
        // TB
        if (v > 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024).toFixed(2) + "TB";
        }
        // GB
        if (v > 1024 * 1024) {
            return Number(v / 1024.0 / 1024).toFixed(2) + "GB";
        }
        // MB
        if (v > 1024) {
            return Number(v / 1024.0).toFixed(2) + "MB";
        }
        return v + "KB";
    };
});

scApp.filter("sc_filter_filerate_k", function(){
    return function(v){
        // PB
        if (v > 1024 * 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024 / 1024).toFixed(2) + "PBps";
        }
        // TB
        if (v > 1024 * 1024 * 1024) {
            return Number(v / 1024.0 / 1024 / 1024).toFixed(2) + "TBps";
        }
        // GB
        if (v > 1024 * 1024) {
            return Number(v / 1024.0 / 1024).toFixed(2) + "GBps";
        }
        // MB
        if (v > 1024) {
            return Number(v / 1024.0).toFixed(2) + "MBps";
        }
        return v + "KBps";
    };
});

scApp.filter("sc_filter_bitrate_k", function(){
    return function(v){
        // PB
        if (v > 1000 * 1000 * 1000 * 1000) {
            return Number(v / 1000.0 / 1000 / 1000 / 1000).toFixed(2) + "Pbps";
        }
        // TB
        if (v > 1000 * 1000 * 1000) {
            return Number(v / 1000.0 / 1000 / 1000).toFixed(2) + "Tbps";
        }
        // GB
        if (v > 1000 * 1000) {
            return Number(v / 1000.0 / 1000).toFixed(2) + "Gbps";
        }
        // MB
        if (v > 1000) {
            return Number(v / 1000.0).toFixed(2) + "Mbps";
        }
        return v + "Kbps";
    };
});

scApp.filter("sc_filter_percent", function(){
    return function(v){
        return Number(v).toFixed(2) + "%";
    };
});

scApp.filter("sc_filter_percentf", function(){
    return function(v){
        return Number(v * 100).toFixed(2) + "%";
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
        // set default value for SRS2.
        v.width = v.width? v.width : 0;
        v.height = v.height? v.height : 0;

        return v? v.codec + "/" + v.profile + "/" + v.level + "/" + v.width + "x" + v.height : "无视频";
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

scApp.filter("sc_filter_obj", function(){
    return function(v) {
        return v != undefined? v : "未设置";
    };
});

scApp.filter("sc_filter_less", function(){
    return function(v) {
        return v? (v.length > 15? v.substr(0, 15) + "...":v):v;
    };
});

scApp.filter("sc_filter_security", function(){
    return function(v) {
        var action = v.action == "allow"? "允许":"禁止";
        var method = v.method == "all"? "任何操作": (v.method == "publish"? "推流":"播放");
        var entry = v.entry == "all"? "所有人" : v.entry;
        return action + " " + entry + " " + method;
    }
});

scApp.filter('sc_filter_style_error', function(){
    return function(v){
        return v? 'alert-danger':'';
    };
});

scApp.filter('sc_filter_preview_url', ['$sc_server', function($sc_server){
    return function(v){
        var page = "http://ossrs.net/players/srs_player.html";
        var rtmp = $sc_server.rtmp[$sc_server.rtmp.length - 1];
        var query = "vhost=" + v.owner.name + "&app=" + v.app + "&stream=" + v.name;
        query += "&server=" + $sc_server.host +"&port=" + rtmp + "&autostart=true";
        return v? page+"?" + query:"javascript:void(0)";
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
scApp.provider("$sc_server", [function(){
    this.$get = function(){
        return {
            schema: "http",
            host: null,
            port: 1985,
            rtmp: [1935],
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
            init: function($location, MSCApi) {
                // query string then url.
                if ($location.search().host) {
                    this.host = $location.search().host;
                } else {
                    this.host = $location.host();
                }

                if ($location.search().port) {
                    this.port = $location.search().port;
                } else {
                    this.port = $location.port();
                }

                // optional, init the rtmp port.
                var self = this;
                MSCApi.configs_get3(function(data){
                    if (data.minimal) {
                        self.rtmp = data.minimal.listen;
                    }
                });
            }
        };
    };
}]);

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
            find_siblings: function(elem, className) {
                if (elem.hasClass(className)) {
                    return elem;
                }

                if (!elem[0].nextSibling) {
                    return null;
                }

                var sibling = angular.element(elem[0].nextSibling);
                return this.find_siblings(sibling, className);
            },
            array_actual_equals: function(a, b) {
                // all elements of a in b.
                for (var i = 0; i < a.length; i++) {
                    if (!system_array_contains(b, a[i])) {
                        return false;
                    }
                }

                // all elements of b in a.
                for (i = 0; i < b.length; i++) {
                    if (!system_array_contains(a, b[i])) {
                        return false;
                    }
                }

                return true;
            },
            refresh: async_refresh2,
            const_raw_api_not_supported: "该服务器不支持HTTP RAW API，或者配置中禁用了该功能。"
        };
    }];
});

// sc-collapse: scCollapse
/**
 * Usage:
        <div class="accordion">
            <div class="accordion-group">
                <div class="accordion-heading" sc-collapse="in">
                    <a class="accordion-toggle" href="javascript:void(0)">
                        HTTP RAW API
                    </a>
                </div>
                <div class="accordion-body collapse">
                    <div class="accordion-inner">
                        该服务器不支持HTTP RAW API，或者配置中禁用了该功能。
                    </div>
                </div>
            </div>
        </div>
 */
scApp.directive('scCollapse', ["$sc_utility", function($sc_utility){
    return {
        restrict: 'A',
        scope: true,
        controller: ['$scope', function($scope) {
        }],
        compile: function(elem, attrs) {
            return function(scope, elem, attrs){
                if (attrs.scCollapse == "in") {
                    var obj = $sc_utility.find_siblings(elem, 'accordion-body');
                    obj.addClass('in');
                }

                elem.on('click', function(){
                    var obj = $sc_utility.find_siblings(elem, 'accordion-body');
                    obj.toggleClass('in');
                });
            };
        }
    };
}]);

// sc-pretty: scPretty
/**
 * Usage:
     <tr sc-pretty scp-key="http_api.enabled" scp-value="http_api.enabled" scp-bool="true"
        scp-desc="是否开启HTTP API，开启后就可以访问SRS提供的API管理服务器。默认: {{false| sc_filter_enabled}}">
     </tr>
 */
scApp.directive("scPretty", [function(){
    return {
        restrict: 'A',
        scope: {
            key: '@scpKey',
            value: '=scpValue',
            desc: '@scpDesc',
            bool: '@scpBool'
        },
        template: ''
            + '<td>{{key}}</td>'
            + '<td>'
                + '<span class="{{value == undefined? \'label\':\'\'}}">'
                    + '<span ng-show="bool && value != undefined">{{value| sc_filter_enabled}}</span>'
                    + '<span ng-show="!bool || value == undefined">{{value| sc_filter_obj}}</span>'
                + '</span>'
            + '</td>'
            + '<td>{{desc}}</td>'
            + '<td>只读</td>'
    };
}]);

// sc-pretty2: scPretty2
/**
 * Usage:
     <tr sc-pretty2 scp-data="global.daemon" scp-bool="true"
        scp-desc="是否以后台启动SRS。默认: {{true| sc_filter_yesno}}">
     </tr>
 */
scApp.directive("scPretty2", [function(){
    return {
        restrict: 'A',
        scope: {
            data: '=scpData',
            desc: '@scpDesc',
            bool: '@scpBool'
        },
        controller: ['$scope', function($scope){
        }],
        template: ''
            + '<td>{{key}}</td>'
            + '<td>'
                + '<span class="{{data.value == undefined? \'label\':\'\'}}">'
                    + '<span ng-show="bool && data.value != undefined">{{data.value| sc_filter_enabled}}</span>'
                    + '<span ng-show="!bool || data.value == undefined">{{data.value| sc_filter_obj}}</span>'
                + '</span>'
            + '</td>'
            + '<td>{{desc}}</td>'
            + '<td>只读</td>',
        link: function(scope, elem, attrs){
            scope.key = system_string_trim(attrs.scpData, "global.");
        }
    };
}]);

// sc-directive: scDirective
/**
 * Usage:
         <tr sc-directive scd-data="obj"
             scd-desc="侦听的端口" scd-default="1935" scd-span="span3"
             scd-array="true" scd-bool="true" scd-select="1935,1936,1937"
             scd-submit="submit(obj)">
         </tr>
 * where obj is:
         {
             key: "listen",
             value: ["1935", "1936"],
             error: false
         }
 */
scApp.directive("scDirective", ["$sc_utility", function($sc_utility){
    return {
        restrict: 'A',
        scope: {
            data: '=scdData',
            desc: '@scdDesc',
            submit: '&scdSubmit',
            span: '@scdSpan',
            default: '@scdDefault',
            array: '@scdArray',
            bool: '@scdBool',
            select: '@scdSelect'
        },
        controller: ['$scope', function($scope) {
            // whether current directive is editing.
            $scope.editing = false;

            // previous old value, for cancel and array value.
            $scope.old_data = {
                init: false,
                value: undefined,
                reset: function(){
                    this.init = false;
                    this.value = undefined;
                }
            };

            // split select to array.
            if (typeof $scope.select == "string" && $scope.select && !$scope.selects) {
                $scope.selects = $scope.select.split(",");
            }

            $scope.edit = function() {
                $scope.editing = true;
            };

            $scope.commit = function() {
                // for array, string to array.
                if ($scope.array == "true" && typeof $scope.data.value == "string") {
                    $scope.data.value = $scope.data.value.split(",");
                }

                if ($scope.old_data.init && !$scope.submit()) {
                    return;
                }

                $scope.editing = false;
                $scope.old_data.reset();
            };

            $scope.load_default = function(){
                if ($scope.default != undefined) {
                    if ($scope.bool == "true") {
                        $scope.data.value = $scope.default == "true";
                    } else if ($scope.array == "true") {
                        $scope.data.value = $scope.default.split(",");
                    } else {
                        $scope.data.value = $scope.default;
                    }
                }
            };

            $scope.cancel = function() {
                if ($scope.old_data.init) {
                    $scope.data.value = $scope.old_data.value;
                }

                // for array, always restore it when cancel.
                if ($scope.array == "true") {
                    $scope.data.value = $scope.old_data.value;
                }

                $scope.editing = false;
                $scope.old_data.reset();
            };

            $scope.$watch("editing", function(nv, ov){
                // init, ignore.
                if (!nv && !nv) {
                    return;
                }

                // when server not set this option, the whole data is undefined.
                if (!$scope.data) {
                    $scope.data = {
                        key: $scope.key,
                        value: undefined,
                        error: false
                    };
                }

                // save the old value.
                if (!$scope.old_data.init) {
                    $scope.old_data.value = $scope.data.value;
                    $scope.old_data.init = true;
                }

                // start editing.
                if (nv && !ov) {
                    // for array, array to string.
                    if ($scope.array == "true") {
                        $scope.data.value = $scope.data.value.join(",");
                    }
                }
            });
        }],
        template: ''
        + '<td class="{{data.error| sc_filter_style_error}}">'
            + '{{key}}'
        + '</td>'
        + '<td colspan="{{editing? 2:0}}" title="{{data.value}}" class="{{data.error| sc_filter_style_error}}">'
            + '<div class="form-inline">'
                + '<span class="{{!data.error && data.value == undefined?\'label\':\'\'}}" ng-show="!editing">'
                    + '<span ng-show="bool == \'true\' && data.value != undefined">{{data.value| sc_filter_enabled}}</span>'
                    + '<span ng-show="bool != \'true\' || data.value == undefined">{{data.value| sc_filter_obj| sc_filter_less}}</span>'
                + '</span> '
                + '<input type="text" class="{{span}} inline" ng-show="editing && bool != \'true\' && !select" ng-model="data.value"> '
                + '<label class="checkbox" ng-show="editing && bool == \'true\'"><input type="checkbox" ng-model="data.value">开启</label> '
                + '<select ng-model="data.value" ng-options="s as s for s in selects" ng-show="editing && select"></select>'
                + '<a href="javascript:void(0)" ng-click="load_default()" ng-show="editing && default != undefined" title="使用默认值">使用默认值</a> '
            + '</div>'
            + '<div ng-show="editing">{{desc}}</div>'
        + '</td>'
        + '<td ng-show="!editing" class="{{data.error| sc_filter_style_error}}">'
            + '{{desc}}'
        + '</td>'
        + '<td class="span1 {{data.error| sc_filter_style_error}}">'
            + '<a href="javascript:void(0)" ng-click="edit()" ng-show="!editing" title="修改">修改</a> '
            + '<a href="javascript:void(0)" ng-click="commit()" ng-show="editing" title="提交">提交</a> '
            + '<a href="javascript:void(0)" ng-click="cancel()" ng-show="editing" title="取消">放弃</a> '
        + '</td>',
        link: function(scope, elem, attrs){
            scope.key = system_string_trim(attrs.scdData, "global.");
        }
    };
}]);

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
                return $q.reject(response);
            }
            return response || $q.when(response);
        },
        'responseError': function(rejection) {
            $sc_utility.http_error(rejection.status, rejection.data);
            return $q.reject(rejection);
        }
    };
}]);
