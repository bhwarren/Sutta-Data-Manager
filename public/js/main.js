var app = angular.module("sutta-data-manager", ["ngRoute", "monospaced.elastic", "ngMaterial"]);
app.config(function($routeProvider, $locationProvider) {
    $routeProvider
    .when("/", {
        templateUrl : "views/home.html",
        controller : 'mainController'
    })
    .when("/sutta", {
        templateUrl : "views/sutta.html",
        controller : 'suttaController'
    })
    .when("/suttaSelector", {
        templateUrl : "views/suttaSelector.html",
        controller : 'mainController'
    })
    .when("/searchSuttaInfo", {
        templateUrl : "views/searchSuttaInfo.html",
        controller : 'searchController'
    });
});

app.controller("sidebarCtrl", function($scope, $timeout, $mdSidenav, $log){

    $scope.openLeftMenu = function() {
        $mdSidenav('left').toggle();
    };
});

app.controller("searchController", function($scope, $http, $routeParams){
    $scope.searchOpts = {
        "value": $routeParams.value,
        "category": $routeParams.category,
    };

    if($routeParams.value && $routeParams.category){

    }

    $scope.search = function(category){
        $scope.searchOpts.category = category;
        $http.post("/searchDB", $scope.searchOpts).then(function(resp){
            $scope.searchResults = resp;
        });
    };

    if($routeParams.value && $routeParams.category){
        $scope.search($routeParams.category);
    }

    $scope.getKeys = function(obj){
        return Object.keys(obj).join(", ");
    };
});

app.controller("mainController", function($scope, $http, $routeParams) {

    if(!$scope.collections){
        $http.get("/js/collectionInfo.json").then(function(resp) {
            $scope.collections = resp.data;
            console.log($scope.collections);
        });
    }

    $scope.range = function(n) {
        return new Array(n);
    };

    $scope.getSutta = function(num, collection, id){
        if( (collection == "DN" && num <= 34) || (collection == "MN" && num <= 152) ||
             collection == "SN" && num <= 56 || collection == "AN" && num <= 11 ){
            if(id){
                return collection+":"+(num);
            }

            if(collection == "SN" || collection == "AN"){
                return collection+" Book "+(num);
            }

            return collection+" "+(num);
        }
    };

});


function isEmpty(str) {
  return str.replace(/^\s+|\s+$/g, '').length === 0;
}


function arraysAreSame(arr1, arr2){
    if(arr1.length == arr2.length){
        for(var i = 0;i <arr1.length; i++){
            if(arr1[i] != arr2[i]){
                return false;
            }
        }
        return true;
    }else{
        return false;
    }
}
app.controller("suttaController", function($scope, $http, $routeParams, $sce){
    if($routeParams.id){
        $http.get("/suttaInfo?id="+$routeParams.id).then(function(resp){
            $scope.originalCurrentSutta = angular.copy(resp.data);
            $scope.currentSutta = angular.copy(resp.data);
            
            $scope.tagsString = $scope.currentSutta.tags.join(",\n");

            $scope.currentSuttaChanges = {};
            angular.forEach(Object.keys($scope.currentSutta), function(key){
                $scope.currentSuttaChanges[key] = false;
            });
        });
    }

    $scope.inputWidth = "700px";

    $scope.editField = function (field) {
        $scope.currentSuttaChanges[field] = true;
        $scope.oldFieldValue = $scope.currentSutta[field];
        if(field == "translations"){
            $scope.translationsEdits = $scope.currentSutta[field].toString().replace(",","\n");
        }
    };

    $scope.doneEditing = function (field) {
        $scope.currentSuttaChanges[field] = false;
        var submitSutta = {id: $scope.currentSutta._id};

        if(field == "translations"){
            //set the currentsutta to the correct string for processing
            //add blank b/c needs to be different otherwise odd vertical behaviour
            $scope.currentSutta[field] = $scope.translationsEdits.replace("\n",",")+" ";
        }
        else if(field == "tags"){
            $scope.currentSutta[field] = $scope.tagsString;
        }
        //if user updated the value
        if($scope.oldFieldValue != $scope.currentSutta[field]){
            console.log("not the same");
            //check for blank fields between commas and remove them
            if(Array.isArray($scope.originalCurrentSutta[field])){
                console.log($scope.currentSutta[field]);
                var newValues = $scope.currentSutta[field].split(/[,\n]+/);
                $scope.currentSutta[field] = [];

                for(var i = 0; i < newValues.length; i++){
                    if( newValues[i].trim().length !== 0 ){
                        $scope.currentSutta[field].push(newValues[i].trim());
                    }
                }
                if( arraysAreSame($scope.currentSutta[field], $scope.oldFieldValue)){
                    return;
                }
            }

            submitSutta[field] = $scope.currentSutta[field];
            $http.post("/", submitSutta).then(function(resp){
                console.log(resp.data);
            });
        }
    };

    $scope.showHideSuttaText = "Show the Full Sutta";

    $scope.showSutta = function(){
        $scope.showSuttaPane = !$scope.showSuttaPane;
        if($scope.showSuttaPane){
            $scope.inputWidth = "40%";

            $scope.showHideSuttaText = "Hide the Full Sutta";
            if(!$scope.suttaPane){
                var suttaURL = $scope.currentSutta.translations[0];
                console.log("getting sutta");
                $http.get('/suttatext?url='+suttaURL).then(function(response) {
                       $scope.suttaPane = $sce.trustAsHtml(response.data);
                   }).catch(function(error){
                       console.log(error);
                   });
            }
        }
        else{
            $scope.inputWidth = "700px";
            $scope.showHideSuttaText = "Show the Full Sutta";
        }
    };

});

app.directive('syncFocusWith', function($timeout, $rootScope) {
    return {
        restrict: 'A',
        scope: {
            focusValue: "=syncFocusWith"
        },
        link: function($scope, $element, attrs) {
            $scope.$watch("focusValue", function(currentValue, previousValue) {
                $timeout(function() {
                    if (currentValue === true && !previousValue) {
                        $element[0].focus();
                    } else if (currentValue === false && previousValue) {
                        $element[0].blur();
                    }
                });

            });
        }
    };
});
