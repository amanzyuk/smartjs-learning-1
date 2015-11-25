'use strict';

var app = {};

//--------------
// Models
//--------------
app.Location = Backbone.Model.extend({
    defaults: {
        id: -1,
        name: ''
    }
});

app.DarkLord = Backbone.Model.extend({
    urlRoot: 'http://jedi.smartjs.academy/dark-jedis/',
    url: function () {
        return this.urlRoot + this.id;
    }, defaults: {
        activeClass: ''
    }
});

//--------------
// Collections
//--------------
app.DarkLords = Backbone.Collection.extend({
    model: app.DarkLord,
    localStorage: new Store('dark-jedis')
});

app.LordsList = function () {
    var vm = this;
    vm.LORDS_COUNT = 5;

    vm.lords = new app.DarkLords();
    vm.activeLord = null;
    vm.activeQuery = null;
    vm.currentLocationId = null;

    vm.findLordByLocationId = findLordByLocationId;
    vm.createEmptyLord = createEmptyLord;
    vm.fetchAndAddNewLord = fetchAndAddNewLord;
    vm.findFirstNotEmptyIndex = findFirstNotEmptyIndex;
    vm.findLastNotEmptyIndex = findLastNotEmptyIndex;
    vm.checkActivePlanet = checkActivePlanet;
    vm.abortActiveQuery = abortActiveQuery;
    vm.fillEmptyLords = fillEmptyLords;
    vm.setCurrentLocationId = setCurrentLocationId;
    vm.scrollUp = scrollUp;
    vm.scrollDown = scrollDown;
    vm.isScrollUpEnabled = isScrollUpEnabled;
    vm.isScrollDownEnabled = isScrollDownEnabled;


    initialize();

    /////////

    function initialize() {
        createLordAndFetchNextApprentice(0, 3616);
        for (var i = vm.lords.length; i < vm.LORDS_COUNT; i++) {
            vm.lords.push(createEmptyLord(vm.lords));
        }
    }

    function createLordAndFetchNextApprentice(index, id) {
        var lord = new app.DarkLord({'id': id});
        lord.fetch()
            .done(function () {
                vm.lords.pop();
                vm.lords.add(lord, {at: index});
                var apprentice = lord.get('apprentice');
                if (apprentice && apprentice.id && vm.lords.length <= vm.LORDS_COUNT) {
                    createLordAndFetchNextApprentice(index + 1, apprentice.id);
                }
            });
    }

    function createEmptyLord() {
        return new app.DarkLord({id: -vm.lords.length - 1});
    }

    function findLordByLocationId(locationId) {
        for (var i = 0; i < vm.lords.length; i++) {
            var homeworld = vm.lords.at(i).get('homeworld');
            if (homeworld && homeworld.id == locationId) {
                return vm.lords.at(i);
            }
        }
    }

    function fetchAndAddNewLord(newLordId, newLordIndex) {
        var newLord = new app.DarkLord({'id': newLordId});
        var xhr = newLord.fetch();
        xhr.done(function () {
            vm.lords.remove(vm.lords.at(newLordIndex));
            vm.lords.add(newLord, {at: newLordIndex});
        });
        return xhr;
    }

    function findFirstNotEmptyIndex() {
        for (var i = 0; i < vm.lords.length; i++) {
            if (vm.lords.at(i).id >= 0) {
                return i;
            }
        }
    }

    function findLastNotEmptyIndex() {
        for (var i = 0; i < vm.lords.length; i++) {
            if (vm.lords.at(i).id < 0) {
                return i - 1;
            }
        }
    }

    function setCurrentLocationId(currentLocationId) {
        vm.currentLocationId = currentLocationId;
    }

    function checkActivePlanet() {
        if (vm.activeLord) {
            var activeLord = vm.activeLord;
            vm.activeLord = null;
            activeLord.set('activeClass', '');
            vm.fillEmptyLords();
        }

        var lord = vm.findLordByLocationId(vm.currentLocationId);
        if (lord) {
            vm.activeLord = lord;
            vm.activeLord.set('activeClass', 'active');
            vm.abortActiveQuery();
        }
    }

    function abortActiveQuery() {
        console.log("abort active query0", vm.activeQuery)
        if (vm.activeQuery) {
            console.log("abort active query", vm.activeQuery)
            vm.activeQuery.abort();
        }
    }

    function fillEmptyLords() {
        if (vm.activeLord) {
            return;
        }

        var firstNotEmptyIndex = vm.findFirstNotEmptyIndex();

        if (firstNotEmptyIndex > 0) {
            var firstNotEmpty = vm.lords.at(firstNotEmptyIndex);
            var newLordId = firstNotEmpty.get('master').id;
            fillNewLord(newLordId, firstNotEmptyIndex - 1);
        } else {
            var lastNotEmptyIndex = vm.findLastNotEmptyIndex();
            if (!lastNotEmptyIndex) {
                return;
            }
            var newLordId = vm.lords.at(lastNotEmptyIndex).get('apprentice').id;

            fillNewLord(newLordId, lastNotEmptyIndex + 1);
        }
    }

    function fillNewLord(newLordId, newLordIndex) {
        if (!newLordId) {
            return;
        }

        var fillNext = vm.fillEmptyLords.bind(this);
        var checkActivePlanet = vm.checkActivePlanet.bind(this);

        vm.activeQuery = vm.fetchAndAddNewLord(newLordId, newLordIndex);
        console.log("set vm.activeQuery " + newLordIndex, vm.activeQuery)
        vm.activeQuery.done(function () {
            vm.activeQuery = null;
            checkActivePlanet();
            fillNext();
        });
    }

    function scrollUp() {
        vm.lords.pop();
        vm.lords.pop();
        vm.lords.unshift(vm.createEmptyLord());
        vm.lords.unshift(vm.createEmptyLord());
    }

    function scrollDown() {
        vm.lords.shift();
        vm.lords.shift();
        vm.lords.push(vm.createEmptyLord());
        vm.lords.push(vm.createEmptyLord());
    }

    function isScrollUpEnabled() {
        var firstMaster = vm.lords.at(0).get('master');
        return !vm.activeLord && firstMaster && firstMaster.id;
    }

    function isScrollDownEnabled() {
        var lastApprentice = vm.lords.at(vm.lords.length - 1).get('apprentice');
        return !vm.activeLord && lastApprentice && lastApprentice.id;
    }
};


//--------------
// Views
//--------------

app.CurrentLocationView = Backbone.View.extend({
    el: '#planet-monitor',
    template: _.template('Obi-Wan currently on <%- name %>'),
    initialize: function () {
        var socket = new WebSocket('ws://jedi.smartjs.academy');
        socket.onmessage = this.onLocationChange.bind(this);
        this.model.on('change', this.render, this);
        this.render();
    },
    onLocationChange: function (event) {
        this.model.set(JSON.parse(event.data));
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this; // enable chained calls
    }
});

app.LordView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#lord-template').html()),
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this; // enable chained calls
    }
});

app.LordsView = Backbone.View.extend({
    el: '#lords-view',
    initialize: function (options) {
        this.currentLocation = options.currentLocation;
        this.model.lords.on('change reset add remove', this.render, this);
        this.currentLocation.on('change', this.currentLocationChanged, this);
    },
    events: {
        'click .css-button-up': 'upPressed',
        'click .css-button-down': 'downPressed'
    },
    currentLocationChanged: function () {
        this.model.setCurrentLocationId(this.currentLocation.get('id'));
        this.model.checkActivePlanet();
    },
    upPressed: function () {
        if (!this.model.isScrollUpEnabled()) {
            return;
        }
        this.model.abortActiveQuery();
        this.model.scrollUp();
        this.model.fillEmptyLords();
    },
    downPressed: function () {
        if (!this.model.isScrollDownEnabled()) {
            return;
        }
        this.model.abortActiveQuery();
        this.model.scrollDown();
        this.model.fillEmptyLords();
    },
    updateScrollsAvailability: function () {
        this.updateScrollButtonAvailability('.css-button-up', this.model.isScrollUpEnabled());
        this.updateScrollButtonAvailability('.css-button-down', this.model.isScrollDownEnabled());
    },
    updateScrollButtonAvailability: function (btnClass, value) {
        var btnEl = $(btnClass);
        if (value) {
            btnEl.removeClass('css-button-disabled')
        } else {
            btnEl.addClass('css-button-disabled')
        }
    },
    renderOne: function (lord) {
        var view = new app.LordView({model: lord});
        $('#lords-list').append(view.render().el);
    },
    render: function () {
        this.$('#lords-list').html('');
        this.model.lords.each(this.renderOne, this);
        this.updateScrollsAvailability();
    }
});


///////////////////////////////////////////////////////

app.currentLocation = new app.Location();
app.lordsList = new app.LordsList();

app.currentLocationView = new app.CurrentLocationView({model: app.currentLocation});
app.lordsView = new app.LordsView({model: app.lordsList, currentLocation: app.currentLocation});



