/* ui */
$(document).ready(function() {
    // function to fill in #hexgrid

    // when they load the page with a gameid in the fragment, try to join that game straight away

    // when they click #about, show a modal with about text
    // when they click game-cancel, send resign & end-game, hide #game, and show #lobby

    function ready() {
        $('#status').text('Ready.');
    }

    function init_hexgrid(player) {
    }

    var ws = new IsopathWS({
        ws: "ws://" + window.location.hostname + ":" + window.location.port + "/ws",
        awaitingOpponent: function(gameid) {
            alert("New game, id = " + gameid);
            $('#opponent-link').attr('href', window.location + '#join-' + gameid);
            $('#opponent-link').text(window.location + '#join-' + gameid);
            $('#await-opponent').show();
            ready();
        },
        gameEnded: function(reason) {
            alert("End game because of " + reason);
            ready();
        },
        gameStarted: function(player) {
            alert("Joined game. We're " + player);
            $('#await-opponent').hide();
            $('#game').show();
            init_hexgrid(player);
            ready();
        },
        movePlayed: function(player, move) {
            // TODO: redraw grid
            ready();
        },
        usToMove: function() {
            alert("Us to move");
            ready();
        },
        opponentToMove: function() {
            alert("Opponent to move");
            ready();
        },
        connected: function() {
            ready();
        },
        disconnected: function() {
            $('#status').text("Disconnected.");
        },
        error: function(err) {
            $('#status').text("Error: " + err);
        },
    });
    ws.connect();
    $('#status').text("Connecting to websocket...");

    // ping every 60s just to keep the websocket open
    window.setInterval(function() {
        ws.ping();
    }, 60000);

    $('#new-game').click(function() {
        $('#lobby').hide();
        $('#status').text("Waiting for websocket server...");
        ws.newGame('white'); // TODO: we should be able to choose
    });

    $('#join-game').click(function() {
        $('#lobby').hide();
        $('#status').text("Waiting for websocket server...");
        ws.joinGame($('#gameid').val());
    });

    $('#await-opponent-cancel').click(function() {
        $('#await-opponent').hide();
        $('#lobby').show();
        ws.endGame();
    });

    $('#await-opponent').hide();
    $('#game').hide();
});
