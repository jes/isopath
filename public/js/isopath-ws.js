/* handle an isopath.js game and a remote websocket
 *
 * ideally this module is not dependent on anything in the browser (i.e. alert, window, etc.)
 * and is therefore suitable for use in nodejs or something
 */

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

IsopathWS.prototype.playMove = function(move) {
    // TODO: handle exceptions from playMove
    this.isopath.playMove(move);
    this.ws.send(JSON.stringify({'op':'play-move','game':this.gameid,'move':move,'board':this.isopath.board,'history':this.isopath.moves}));
    this.opts.opponentToMove();
};

IsopathWS.prototype.ping = function() {
    this.ws.send(JSON.stringify({'op':'ping'}));
};

IsopathWS.prototype.disconnect = function() {
    this.ws.onclose = function() {};
    this.ws.close();
};

IsopathWS.prototype.connect = function() {
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
        _isothis.opts.error("Unknown websocket error");
    };
    ws.onmessage = function(e) {
        msg = JSON.parse(e.data);

        if (msg.op == 'new-game') {
            _isothis.opts.awaitingOpponent(msg.game);
            _isothis.gameid = msg.game;
        } else if (msg.op == 'end-game') {
            _isothis.opts.gameEnded('end-game');
        } else if (msg.op == 'start-game') {
            _isothis.opts.gameStarted(msg.player);
            _isothis.player = msg.player;
            _isothis.gameid = msg.game;
            if (msg.player == _isothis.isopath.curplayer) {
                _isothis.opts.usToMove();
            } else {
                _isothis.opts.opponentToMove();
            }
        } else if (msg.op == 'play-move') {
            try {
                _isothis.isopath.playMove(msg.move);
            } catch(e) {
                // TODO: say what the attempted move was
                _isothis.isopath.gameEnded("Invalid move from opponent: " + e);
                return;
            };
            _isothis.opts.movePlayed(_isothis.player, msg.move);
            if (_isothis.isopath.curplayer == _isothis.player) {
                _isothis.opts.usToMove();
            } else {
                _isothis.opts.error("SERVER TOLD US ABOUT OUR OWN MOVE!? OR WE'RE OUT OF SYNC ON WHOSE TURN IT IS");
            }
        } else if (msg.op == 'disconnected') {
            _isothis.opts.gameEnded('disconnected');
        } else if (msg.op == 'error') {
            _isothis.opts.error(msg.error);
        }
    };
};
