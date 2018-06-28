/* isopath game rules and state tracking */
function Isopath() {
    // the set of all valid places
    this.all_places = [
          'a1','a2','a3','a4',
        'b1','b2','b3','b4','b5',
      'c1','c2','c3','c4','c5','c6',
    'd1','d2','d3','d4','d5','d6','d7',
      'e1','e2','e3','e4','e5','e6',
        'f1','f2','f3','f4','f5',
          'g1','g2','g3','g4'
    ];

    this.homerow = {
        'white':['a1','a2','a3','a4'],
        'black':['g1','g2','g3','g4'],
    };

    this.playerlevel = {
        'white': 2,
        'black': 0,
    };

    this.other = {
        'white': 'black',
        'black': 'white',
    };

    // build an adjacency list of all of the places
    this.adjacent = {};
    for (var i = 0; i < this.all_places.length; i++) {
        var place = this.all_places[i];
        var row = place.charAt(0);
        var column = Number.parseInt(place.charAt(1));

        // add candidate places to adj; invalid place names are filtered out before
        // insertion into this.adjacent
        adj = [];

        adj.push(row + (column-1));
        adj.push(row + (column+1));

        var prevrow = String.fromCharCode(place.charCodeAt(0)-1);
        var nextrow = String.fromCharCode(place.charCodeAt(0)+1);

        adj.push(prevrow + column);
        adj.push(nextrow + column);

        if (['a','b','c','d'].indexOf(row) != -1) {
            adj.push(prevrow+(column-1));
        } else {
            adj.push(prevrow+(column+1));
        }

        if (['a','b','c'].indexOf(row) != -1) {
            adj.push(nextrow+(column+1));
        } else {
            adj.push(nextrow+(column-1));
        }

        this.adjacent[place] = [];
        for (var j = 0; j < adj.length; j++) {
            if (this.is_place(adj[j]))
                this.adjacent[place].push(adj[j]);
        }
    }

    // lateral teleports
    this.adjacent["g1"].push("g4");
    this.adjacent["g4"].push("g1");
    this.adjacent["d1"].push("d7");
    this.adjacent["d7"].push("d1");
    this.adjacent["a1"].push("a4");
    this.adjacent["a4"].push("a1");

    // game state tracking
    this.moves = [];
    this.curplayer = 'white';

    // pieces are initially on the players' home rows
    this.board = {
        'white':this.homerow["white"].slice(),
        'black':this.homerow["black"].slice(),
    };

    // most places have height=1...
    for (var i = 0; i < this.all_places.length; i++) {
        this.board[this.all_places[i]] = 1;
    }
    // ...apart from the home rows
    for (var i = 0; i < 4; i++) {
        this.board[this.homerow["white"][i]] = this.playerlevel['white'];
        this.board[this.homerow["black"][i]] = this.playerlevel['black'];
    }
}

Isopath.prototype.is_place = function(place) {
    return this.all_places.indexOf(place) != -1;
};

// return 'white', 'black', or '' depending on what piece (if any) is on this place
Isopath.prototype.piece_at = function(place, brd) {
    if (!brd)
        brd = this.board;
    if (brd["white"].indexOf(place) != -1)
        return 'white';
    if (brd["black"].indexOf(place) != -1)
        return 'black';
    return '';
};

Isopath.prototype.winner = function(brd) {
    for (var i = 0; i < 4; i++) {
        if (this.piece_at(this.homerow["white"][i],brd) == 'black')
            return 'black';
        if (this.piece_at(this.homerow["black"][i],brd) == 'white')
            return 'white';
    }
    return false;
};

Isopath.prototype.playMove = function(move, mode) {
    if (move.length > 2)
        throw "move may never have more than 2 halves";

    if (move.length == 2 && move[0][0] == move[1][0])
        throw "can't play two halfmoves of the same type";

    // XXX: is there a better way to deep-copy?
    var newboard = JSON.parse(JSON.stringify(this.board));

    for (var i = 0; i < move.length; i++) {
        var movetype = move[i][0];
        var from = move[i][1];
        var to = move[i][2];

        if (!this.is_place(from))
            throw "place " + from + " is not recognised";
        if (movetype != 'capture' && !this.is_place(to))
            throw "place " + to + " is not recognised";
        if (movetype != 'capture' && from == to)
            throw "can't move something from a tile to the same tile";

        if (movetype == 'tile') {
            if (newboard[from] == 0)
                throw "can't move a tile from an empty place";
            if (newboard[to] == 2)
                throw "can't move a tile to a full place";
            if (this.homerow[this.curplayer].indexOf(from) != -1 || this.homerow[this.curplayer].indexOf(to) != -1)
                throw "can't build on your own home row";
            if (newboard["white"].indexOf(from) != -1 || newboard["white"].indexOf(to) != -1 || newboard["black"].indexOf(from) != -1 || newboard["black"].indexOf(to) != -1)
                throw "can't move a tile to/from a place with a piece on it";
            newboard[from]--;
            newboard[to]++;

        } else if (movetype == 'piece') {
            if (this.piece_at(from, newboard) != this.curplayer)
                throw "can't move a piece you don't have";
            if (this.piece_at(to, newboard) != '')
                throw "can't move to an occupied place";
            if (newboard[to] != this.playerlevel[this.curplayer])
                throw "can't move a piece to a place of the wrong height";
            newboard[this.curplayer][newboard[this.curplayer].indexOf(from)] = to;

        } else if (movetype == 'capture') {
            if (this.piece_at(from, newboard) != this.other[this.curplayer])
                throw "can't capture anything other than an enemy";
            var adjacent_men = 0;
            for (var j = 0; j < this.adjacent[from].length; j++) {
                // check where curplayer's men were on this.board (instead of newboard)
                // because the piece must have been capturable at the start of this turn,
                // i.e. you can't walk up to an enemy and capture him all in one turn
                if (this.piece_at(this.adjacent[from][j], this.board) == this.curplayer)
                    adjacent_men++;
            }
            if (adjacent_men < 2)
                throw "can't capture without 2 pieces threatening";
            newboard[this.other[this.curplayer]].splice(newboard[this.other[this.curplayer]].indexOf(from), 1);

        } else {
            throw "don't recognise move type " + movetype;
        }
    }

    // just return now if we're only checking the (half-)move for legality
    if (mode && mode == 'legality-test')
        return;

    if (move.length == 1 && !this.winner(newboard))
        throw "move must have two halves except when the first half wins the game";

    // didn't throw any exceptions, so let's commit to the move:
    this.board = newboard;
    this.moves.push(move);
    this.curplayer = this.other[this.curplayer];
};

Isopath.prototype.isLegalMove = function(move) {
    try {
        this.playMove(move, "legality-test");
    } catch(e) {
        return false;
    };
    return true;
};
