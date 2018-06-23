/* interaction between isopath.js and the remote websocket */
function IsopathWS(opts) {
    this.opts = opts;
    this.isopath = new Isopath();
}

IsopathWS.prototype.newGame = function(player) {
    this.ws.send(JSON.stringify({'op':'new-game','player':player}));
};

IsopathWS.prototype.joinGame = function(gameid) {
    this.ws.send(JSON.stringify({'op':'join-game','game':gameid}));
};

IsopathWS.prototype.endGame = function() {
    this.ws.send(JSON.stringify({'op':'end-game','game':this.gameid}));
};

IsopathWS.prototype.connect = function() {
    console.log(this.opts.ws);
    var ws = new WebSocket(this.opts.ws);
    this.ws = ws;

    var _isothis = this;

    ws.onopen = function(e) {
        _isothis.opts.connected();
    };
    ws.onclose = function(e) {
        _isothis.opts.disconnected();
    };
    ws.onerror = function(e) {
        _isothis.opts.websocketError();
    };
    ws.onmessage = function(e) {
        console.log(e.data);

        msg = JSON.parse(e.data);

        // TODO: do we need to pay attention to the game id we're given,
        // even if we only support one game?
        if (msg.op == 'new-game') {
            _isothis.opts.awaitingOpponent(msg.game);
            _isothis.gameid = msg.game;
        } else if (msg.op == 'end-game') {
            _isothis.opts.gameEnded('end-game');
        } else if (msg.op == 'start-game') {
            _isothis.opts.gameStarted(msg.player);
            _isothis.player = msg.player;
            if (_isothis.player == 'white') {
                _isothis.opts.usToMove();
            } else {
                _isothis.opts.opponentToMove();
            }
        } else if (msg.op == 'play-move') {
        } else if (msg.op == 'disconnected') {
            _isothis.opts.gameEnded('disconnected');
        } else if (msg.op == 'error') {
        }
    };
};
