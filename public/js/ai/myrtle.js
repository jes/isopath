/* third isopath ai: monte carlo tree search
 * https://jeffbradberry.com/posts/2015/09/intro-to-monte-carlo-tree-search/
 */

function Myrtle(isopath) {
    this.isopath = isopath;
    this.max_think = 10000; // ms
    this.plays = {};
    this.wins = {};
}

Myrtle.prototype.strboard = function(isopath) {
    var s = '';
    for (var i = 0; i < isopath.all_places.length; i++) {
        s += "" + isopath.board[isopath.all_places[i]];
    }
    s += ";";
    for (var i = 0; i < isopath.board['white'].length; i++) {
        s += isopath.board['white'][i];
    }
    s += ";";
    for (var i = 0; i < isopath.board['black'].length; i++) {
        s += isopath.board['black'][i];
    }
    s += ";" + isopath.curplayer;
    return s;
};

Myrtle.prototype.legal_moves = function(isopath) {
    var legal = [];

    var me = isopath.curplayer;

    // TODO: captures; move a piece and then move a tile on/off the place you moved the piece from

    for (var i = 0; i < isopath.all_places.length; i++) {
        var tilefrom = isopath.all_places[i];
        if (isopath.piece_at(tilefrom) != '')
            continue;
        for (var j = 0; j < isopath.all_places.length; j++) {
            var tileto = isopath.all_places[j];
            if (isopath.piece_at(tileto) != '')
                continue;
            if (!isopath.isLegalMove([['tile', tilefrom, tileto]], 'halfmove-check'))
                continue;
            for (var k = 0; k < isopath.board[me].length; k++) {
                var piecefrom = isopath.board[me][k];
                for (var l = 0; l < isopath.adjacent[piecefrom].length; l++) {
                    var pieceto = isopath.adjacent[piecefrom][l];
                    var move = [['tile', tilefrom, tileto], ['piece', piecefrom, pieceto]];
                    if (isopath.isLegalMove(move))
                        legal.push(move);
                }
            }
        }
    }

    return legal;
};

Myrtle.prototype.run_simulation = function(isopath) {
    var visited_states = [];
    var expand = true;
    var startplayer = isopath.curplayer;

    for (var t = 0; t < 200; t++) {
        var legal = this.legal_moves(isopath);
        var play = legal[Math.floor(Math.random() * legal.length)];

        isopath.playMove(play);

        var strb = this.strboard(isopath);

        if (expand && !(strb in this.plays)) {
            expand = false;
            this.plays[strb] = 0;
            this.wins[strb] = 0;
        }

        visited_states.push(strb);

        if (isopath.winner())
            break;
    }

    for (var i = 0; i < visited_states.length; i++) {
        var strb = visited_states[i];
        if (!(strb in this.plays))
            continue;

        this.plays[strb]++;
        if (isopath.winner() == startplayer)
            this.wins[strb]++;
    }
};

Myrtle.prototype.move = function() {
    var legal = this.legal_moves(this.isopath);

    if (legal.length == 0)
        throw "no legal moves";
    else if (legal.length == 1)
        return legal[0];

    // run some simulations during our thinking time
    var games = 0;
    var start = Date.now();
    while (Date.now() < start + this.max_think) {
        this.run_simulation(this.isopath.clone());
        games++;
    }
    console.log("Simulated " + games + " games");

    // map reachable game states to the move required to reach that state
    var ip = this.isopath.clone();
    var move_for_state = {};
    for (var i = 0; i < legal.length; i++) {
        ip.playMove(legal[i]);
        move_for_state[this.strboard(ip)] = legal[i];
        ip.undoMove();
    }

    // pick the reachable state that has the highest percentage of wins
    var best = -1;
    var move = [];
    for (state in move_for_state) {
        var score = this.wins[state] / this.plays[state];
        if (score > best) {
            best = score;
            move = move_for_state[state];
        }
    }

    console.log({move:move,best:best});

    return move;
};

IsopathAI.register_ai('myrtle', 'Myrtle', function(isopath) {
    return new Myrtle(isopath);
});
