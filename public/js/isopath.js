/* isopath game rules and state tracking */
function Isopath() {
    // the set of all valid tiles
    this.all_tiles = [
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

    // build an adjacency list of all of the tiles
    this.adjacent = {};
    for (var i = 0; i < this.all_tiles.length; i++) {
        var tile = this.all_tiles[i];
        var row = tile.charAt(0);
        var column = Number.parseInt(tile.charAt(1));

        // add candidate tiles to adj; invalid tile names are filtered out before
        // insertion into this.adjacent
        adj = [];

        adj.push(row + (column-1));
        adj.push(row + (column+1));

        var prevrow = String.fromCharCode(tile.charCodeAt(0)-1);
        var nextrow = String.fromCharCode(tile.charCodeAt(0)+1);

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

        this.adjacent[tile] = [];
        for (var j = 0; j < adj.length; j++) {
            if (this.is_tile(adj[j]))
                this.adjacent[tile].push(adj[j]);
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

    // most tiles have height=1...
    for (var i = 0; i < this.all_tiles.length; i++) {
        this.board[this.all_tiles[i]] = 1;
    }
    // ...apart from the home rows
    for (var i = 0; i < 4; i++) {
        this.board[this.homerow["white"][i]] = this.playerlevel['white'];
        this.board[this.homerow["black"][i]] = this.playerlevel['black'];
    }
}

Isopath.prototype.is_tile = function(tile) {
    return this.all_tiles.indexOf(tile) != -1;
};

// return 'white', 'black', or '' depending on what piece (if any) is on this tile
Isopath.prototype.piece_at = function(tile) {
    if (this.board["white"].indexOf(tile) != -1)
        return 'white';
    if (this.board["black"].indexOf(tile) != -1)
        return 'black';
    return '';
};

Isopath.prototype.playMove = function(move) {
    if (move.length != 2)
        throw "move must have 2 components";

    // TODO: if the second halfmove is a capture, swap the order of the halfmoves so that players
    // can't walk up to an enemy and then capture it in just one turn

    // TODO: invalid moves shouldn't get partially-applied

    if (move[0][0] == move[1][0])
        throw "can't play two halfmoves of the same type";

    for (var i = 0; i < 2; i++) {
        var movetype = move[i][0];
        var from = move[i][1];
        var to = move[i][2];

        if (!this.is_tile(from))
            throw "tile " + from + " is not recognised";
        if (movetype != 'capture' && !this.is_tile(to))
            throw "tile " + to + " is not recognised";

        if (movetype == 'brick') {
            if (this.board[from] == 0)
                throw "can't move a brick from an empty tile";
            if (this.board[to] == 2)
                throw "can't move a brick to a full tile";
            if (this.homerow[this.curplayer].indexOf(from) != -1 || this.homerow[this.curplayer].indexOf(to) != -1)
                throw "can't build on your own home row";
            this.board[from]--;
            this.board[to]++;

        } else if (movetype == 'piece') {
            if (this.piece_at(from) != this.curplayer)
                throw "can't move a piece you don't have";
            if (this.piece_at(to) != '')
                throw "can't move to an occupied tile";
            if (this.board[to] != this.playerlevel[this.curplayer])
                throw "can't move a piece to a tile of the wrong height";
            this.board[this.curplayer][this.board[this.curplayer].indexOf(from)] = to;

        } else if (movetype == 'capture') {
            if (this.piece_at(from) != this.other[this.curplayer])
                throw "can't capture anything other than an enemy";
            var adjacent_men = 0;
            for (var j = 0; j < this.adjacent[from].length; j++) {
                if (this.piece_at(this.adjacent[from][j]) == this.curplayer)
                    adjacent_men++;
            }
            if (adjacent_men < 2)
                throw "can't capture without 2 pieces threatening";
            this.board[this.other[this.curplayer]].splice(this.board[this.other[this.curplayer]].indexOf(from), 1);

        } else {
            throw "don't recognise move type " + movetype;
        }
    }

    this.moves.push(move);
    this.curplayer = this.other[this.curplayer];
};
