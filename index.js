'use strict';

var app = {};
app.LORDS_COUNT = 5;

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


//--------------
// Views
//--------------

app.CurrentLocationView = Backbone.View.extend({
    el: '#planet-monitor',
    template: _.template('Obi-Wan currently on <%- name %>'),
    initialize: function () {
        this.model.on('change', this.render, this);
        this.render();
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
        this.options = options;
        console.log('===>> options: ', this)
        this.model.on('reset add remove', this.render, this);
        this.options.currentLocation.on('change', this.checkActivePlanet, this);
    },
    events: {
        'click .css-button-up': 'upPressed',
        'click .css-button-down': 'downPressed'
    },
    checkActivePlanet: function () {
        console.log('===> changed', this.options.currentLocation.get('id'));
        var lord = findLordByLocationId(this.model, this.options.currentLocation.get('id'));
        if (this.activeLord) {
            this.activeLord.set('activeClass', '');
            this.activeLord = null;
            this.render();
            this.fill();
        }

        if (lord) {
            console.log("ACTIVE PLANET FOUND");
            this.activeLord = lord;
            lord.set('activeClass', 'active');
            this.abortActiveQuery();
            this.render();
        }
        console.log("====> lord by planet ", this.options.currentLocation.get('name'), lord);
    },
    upPressed: function () {
        if (!this.isScrollUpEnabled()) {
            return;
        }
        this.abortActiveQuery();
        this.model.pop();
        this.model.pop();
        this.model.unshift(createEmptyLord(this.model));
        this.model.unshift(createEmptyLord(this.model));
        this.fill();
    },
    downPressed: function () {
        if (!this.isScrollDownEnabled()) {
            return;
        }
        this.abortActiveQuery();
        this.model.shift();
        this.model.shift();
        this.model.push(createEmptyLord(this.model));
        this.model.push(createEmptyLord(this.model));
        this.fill();
    },
    abortActiveQuery: function() {
        if (this.activeQuery) {
            this.activeQuery.abort();
        }
    },
    fill: function () {
        var lords = this.model;
        var fillNext = this.fill.bind(this);
        var checkActivePlanet = this.checkActivePlanet.bind(this);

        var firstNotEmptyIndex = findFirstNotEmptyIndex(lords);

        if (firstNotEmptyIndex > 0) {
            console.log(">>>>>>>>firstNotEmptyIndex: ", firstNotEmptyIndex);
            var firstNotEmpty = lords.at(firstNotEmptyIndex);

            var newLordId = firstNotEmpty.get('master').id;
            if (!newLordId) {
                return;
            }

            this.activeQuery = fetchAndAddNewLord(lords, newLordId, firstNotEmptyIndex - 1);
            this.activeQuery.done(function () {
                checkActivePlanet();
                fillNext();
            }).always(function () {
                this.activeQuery = null;
            });
        } else {
            var lastNotEmptyIndex = findLastNotEmptyIndex(lords);
            console.log(">>>>>>>>lastNotEmptyIndex: ", lastNotEmptyIndex);
            if (!lastNotEmptyIndex) {
                return;
            }
            var newLordId = this.model.at(lastNotEmptyIndex).get('apprentice').id;
            if (!newLordId) {
                return;
            }
            this.activeQuery = fetchAndAddNewLord(lords, newLordId, lastNotEmptyIndex + 1);
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
        var firstMaster = this.model.at(0).get('master');
        return !this.activeLord && firstMaster && firstMaster.id;
    },
    isScrollDownEnabled: function () {
        var lastApprentice = this.model.at(this.model.length - 1).get('apprentice');
        return !this.activeLord && lastApprentice && lastApprentice.id;
    },
    renderOne: function (lord) {
        var view = new app.LordView({model: lord});
        $('#lords-list').append(view.render().el);
    },
    render: function () {
        this.$('#lords-list').html('');
        this.model.each(this.renderOne, this);
        this.updateScrollsAvailability();
    }
});


var socket = new WebSocket('ws://jedi.smartjs.academy');


app.currentLocation = new app.Location();
app.lords = new app.DarkLords();

socket.onmessage = function (event) {
    app.currentLocation.set(JSON.parse(event.data));
};

app.currentLocationView = new app.CurrentLocationView({model: app.currentLocation});
app.lordsView = new app.LordsView({model: app.lords, currentLocation: app.currentLocation});


//TODO: crate LordsList wrapper
createLordAndFetchNextApprentice(0, 3616);

for (var i = app.lords.length; i < app.LORDS_COUNT; i++) {
    app.lords.push(createEmptyLord(app.lords));
}

function findLordByLocationId(lords, locationId) {
    for (var i = 0; i < lords.length; i++) {
        var homeworld = lords.at(i).get('homeworld');
        if (homeworld && homeworld.id == locationId) {
            return lords.at(i);
        }
    }
}

function createEmptyLord(lords) {
    return new app.DarkLord({id: -lords.length - 1});
}

function fetchAndAddNewLord(lords, newLordId, newLordIndex) {
    var newLord = new app.DarkLord({'id': newLordId});
    var xhr = newLord.fetch();
    xhr.done(function () {
        lords.remove(lords.at(newLordIndex));
        lords.add(newLord, {at: newLordIndex});
    });
    return xhr;
}

function findFirstNotEmptyIndex(lords) {
    for (var i = 0; i < lords.length; i++) {
        if (lords.at(i).id >= 0) {
            return i;
        }
    }
}

function findLastNotEmptyIndex(lords) {
    for (var i = 0; i < lords.length; i++) {
        if (lords.at(i).id < 0) {
            return i - 1;
        }
    }
}

function createLordAndFetchNextApprentice(index, id) {
    var lord = new app.DarkLord({'id': id});
    lord.fetch()
        .done(function () {
            app.lords.pop();
            app.lords.add(lord, {at: index});
            var apprentice = lord.get('apprentice');
            if (apprentice && apprentice.id && app.lords.length < 6) {
                createLordAndFetchNextApprentice(index + 1, apprentice.id);
            }
        });
}