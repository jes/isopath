/* example Isopath AI */

function RandomMoves(isopath) {
    this.isopath = isopath;
}

RandomMoves.prototype.randplace = function() {
    return this.isopath.all_places[Math.floor(Math.random() * this.isopath.all_places.length)];
};

RandomMoves.prototype.move = function() {
    var ip = this.isopath;
    var me = ip.curplayer;
    var you = ip.other[me];

    var move = [];

    // always capture a piece if we can
    for (var i = 0; i < ip.board[you].length; i++) {
        if (ip.isLegalMove([["capture",ip.board[you][i]]], 'halfmove-check')) {
            move.push(["capture",ip.board[you][i]]);
            break; // break because you're only allowed one capture per turn
        }
    }

    // generate random candidate moves until we find one that is legal
    for (var i = 0; i < 10000; i++) {
        var thismove;

        // move a tile from a random location to another random location
        do {
            thismove = [["tile",this.randplace(),this.randplace()]];
        } while(!ip.isLegalMove(move.concat(thismove), 'halfmove-check'));

        // only move a piece if we didn't already capture a piece
        if (move.length == 0) {
            // choose a random location that has one of our pieces
            var from = ip.board[me][Math.floor(Math.random() * ip.board[me].length)];

            // get the list of adjacent tiles
            var adjs = ip.adjacent[from];

            // choose a random adjacent tile
            var to = adjs[Math.floor(Math.random() * adjs.length)];

            thismove.push(["piece",from,to]);
        }

        // if our full move is legal, return it
        if (ip.isLegalMove(move.concat(thismove)))
            return move.concat(thismove);
    }

    // can't find a legal move after 10k attempts:
    throw "can't find a legal move";
};

IsopathAI.register_ai('random-moves', 'Random moves', function(isopath) {
    return new RandomMoves(isopath);
});
