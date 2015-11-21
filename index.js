'use strict';

var app = {}; // create namespace for our app

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
    }
});

//--------------
// Collections
//--------------
app.DarkLords = Backbone.Collection.extend({
    model: app.DarkLord,
    localStorage: new Store("dark-jedis")
});


//--------------
// Views
//--------------

app.CurrentLocationView = Backbone.View.extend({
    el: '#planet-monitor',
    template: _.template('Obi-Wan currently on <%- name %>'),
    initialize: function () {
        //console.log('====> init', this.model);
        this.model.on("change", this.render, this);
        this.render();
    },
    render: function () {
        //console.log('====> render');
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
    initialize: function () {
        this.model.on('"reset add remove"', this.addAll, this);
    },
    events: {
        "click .css-button-up": "upPressed",
        "click .css-button-down": "downPressed"
    },
    upPressed: function (e) {
        var view = this;
        if (this.scrollingUp) {
            console.log("skip scrolling up");
            return;
        }
        if (this.activeScrollDown) {
            this.activeScrollDown.abort();
            console.log("active scroll down aborted");
        }

        this.scrollingUp = true;
        //TODO: abort old
        var scrollUp = this.scrollUp.bind(this);
        $.when(scrollUp()).always(function() {
            $.when(scrollUp()).always(function() {
                view.scrollingUp = false;
            });
        });

    },
    scrollUp: function() {
        var firstMaster = this.model.at(0).get('master');
        if (!firstMaster || !firstMaster.id) {
            return;
        }

        var lord = new app.DarkLord({'id': firstMaster.id});
        var lords = this.model;
        var d = lord.fetch()
            .done(function() {
                if (lords.length >= 5) {
                    lords.pop();
                }
                lords.unshift(lord);
            }).always(function(){
                this.activeScrollUp = null;
            });
        this.activeScrollUp = d;
        return d;
    },
    downPressed: function (e) {
        var view = this;
        if (this.scrollingDown) {
            console.log("skip scrolling down");
            return;
        }

        if (this.activeScrollUp) {
            this.activeScrollUp.abort();
            console.log("active scroll up aborted");
        }
        this.scrollingDown = true;
        //TODO: abort old
        var scrollDown = this.scrollDown.bind(this);
        $.when(scrollDown()).always(function() {
            $.when(scrollDown()).always(function() {
                view.scrollingDown = false;
            });;
        });
    },
    scrollDown: function() {
        var lastApprentice = this.model.at(this.model.length - 1).get('apprentice');
        if (!lastApprentice || !lastApprentice.id) {
            return;
        }

        var lord = new app.DarkLord({'id': lastApprentice.id});
        var lords = this.model;
        var d = lord.fetch()
            .done(function() {
                if (lords.length >= 5) {
                    lords.shift();
                }
                lords.push(lord);
            }).always(function(){
                this.activeScrollDown = null;
            });
        this.activeScrollDown = d;
        return d;
    },
    addOne: function (lord) {
        var view = new app.LordView({model: lord});
        $('#lords-list').append(view.render().el);
    },
    addAll: function () {
        this.$('#lords-list').html(''); // clean the todo list
        this.model.each(this.addOne, this);
    }
});



var socket = new WebSocket("ws://jedi.smartjs.academy");


app.currentLocation = new app.Location();
app.lords = new app.DarkLords();

socket.onmessage = function (event) {
    app.currentLocation.set(JSON.parse(event.data));
};

app.currentLocationView = new app.CurrentLocationView({model: app.currentLocation});
app.lordsView = new app.LordsView({model: app.lords});


createLordAndFetchNext(3616);

function createLordAndFetchNext(id) {
    var lord = new app.DarkLord({'id': id});
    console.log("createLordAndFetchNext id: ", lord.toJSON());
    lord.fetch()
        .done(function () {
            console.log("====lord done: ", lord.toJSON());
            console.log("lords: ", app.lords);
            app.lords.push(lord);
            var apprentice = lord.get('apprentice');
            if (apprentice && apprentice.id && app.lords.length < 6) {
                createLordAndFetchNext(apprentice.id);
            }
        });
}