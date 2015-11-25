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
        activeClass:  ''
    }
});

//--------------
// Collections
//--------------
app.DarkLords = Backbone.Collection.extend({
    model: app.DarkLord,
    localStorage: new Store('dark-jedis')
});

app.LordsList = function() {
    var vm = this;
    vm.LORDS_COUNT = 5;

    vm.lords = new app.DarkLords();

    vm.findLordByLocationId = findLordByLocationId;
    vm.createEmptyLord = createEmptyLord;
    vm.fetchAndAddNewLord = fetchAndAddNewLord;
    vm.findFirstNotEmptyIndex = findFirstNotEmptyIndex;
    vm.findLastNotEmptyIndex = findLastNotEmptyIndex;

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
}


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
        this.lordsList = this.model.lords;
        this.lordsList.on('change reset add remove', this.render, this);
        this.currentLocation.on('change', this.checkActivePlanet, this);
    },
    events: {
        'click .css-button-up': 'upPressed',
        'click .css-button-down': 'downPressed'
    },
    checkActivePlanet: function () {
        if (this.activeLord) {
            this.activeLord.set('activeClass', '');
            this.activeLord = null;
            this.fill();
        }

        var lord = this.model.findLordByLocationId(this.currentLocation.get('id'));
        if (lord) {
            this.activeLord = lord;
            lord.set('activeClass', 'active');
            this.abortActiveQuery();
        }
    },
    upPressed: function () {
        if (!this.isScrollUpEnabled()) {
            return;
        }
        this.abortActiveQuery();
        this.lordsList.pop();
        this.lordsList.pop();
        this.lordsList.unshift(this.model.createEmptyLord());
        this.lordsList.unshift(this.model.createEmptyLord());
        this.fill();
    },
    downPressed: function () {
        if (!this.isScrollDownEnabled()) {
            return;
        }
        this.abortActiveQuery();
        this.lordsList.shift();
        this.lordsList.shift();
        this.lordsList.push(this.model.createEmptyLord());
        this.lordsList.push(this.model.createEmptyLord());
        this.fill();
    },
    abortActiveQuery: function() {
        if (this.activeQuery) {
            this.activeQuery.abort();
        }
    },
    fill: function () {
        if (this.activeLord) {
            return;
        }

        var lords = this.lordsList;
        var fillNext = this.fill.bind(this);
        var checkActivePlanet = this.checkActivePlanet.bind(this);

        var firstNotEmptyIndex = this.model.findFirstNotEmptyIndex();

        if (firstNotEmptyIndex > 0) {
            var firstNotEmpty = lords.at(firstNotEmptyIndex);

            var newLordId = firstNotEmpty.get('master').id;
            if (!newLordId) {
                return;
            }

            var newLordIndex = firstNotEmptyIndex - 1;
            this.activeQuery = this.model.fetchAndAddNewLord(newLordId, newLordIndex);
            this.activeQuery.done(function () {
                checkActivePlanet();
                fillNext();
            }).always(function () {
                this.activeQuery = null;
            });
        } else {
            var lastNotEmptyIndex = this.model.findLastNotEmptyIndex(lords);
            if (!lastNotEmptyIndex) {
                return;
            }
            var newLordId = this.lordsList.at(lastNotEmptyIndex).get('apprentice').id;
            if (!newLordId) {
                return;
            }
            var newLordIndex = lastNotEmptyIndex + 1;
            this.activeQuery = this.model.fetchAndAddNewLord(newLordId, newLordIndex);
            this.activeQuery.done(function () {
                checkActivePlanet();
                fillNext();
            }).always(function () {
                this.activeQuery = null;
            });
            ;
        }
    },
    updateScrollsAvailability: function () {
        this.updateScrollButtonAvailability('.css-button-up', this.isScrollUpEnabled());
        this.updateScrollButtonAvailability('.css-button-down', this.isScrollDownEnabled());
    },
    updateScrollButtonAvailability: function (btnClass, value) {
        var btnEl = $(btnClass);
        if (value) {
            btnEl.removeClass('css-button-disabled')
        } else {
            btnEl.addClass('css-button-disabled')
        }
    },
    isScrollUpEnabled: function () {
        var firstMaster = this.lordsList.at(0).get('master');
        return !this.activeLord && firstMaster && firstMaster.id;
    },
    isScrollDownEnabled: function () {
        var lastApprentice = this.lordsList.at(this.lordsList.length - 1).get('apprentice');
        return !this.activeLord && lastApprentice && lastApprentice.id;
    },
    renderOne: function (lord) {
        var view = new app.LordView({model: lord});
        $('#lords-list').append(view.render().el);
    },
    render: function () {
        this.$('#lords-list').html('');
        this.lordsList.each(this.renderOne, this);
        this.updateScrollsAvailability();
    }
});


///////////////////////////////////////////////////////

app.currentLocation = new app.Location();

var lordsList = new app.LordsList();
app.currentLocationView = new app.CurrentLocationView({model: app.currentLocation});
app.lordsView = new app.LordsView({model: lordsList, currentLocation: app.currentLocation});



