// Functional Card Columns and Rule Checks (With Bugs)

document.addEventListener('DOMContentLoaded', () => {
    const elems = {
        header: document.getElementById('game-header'),
        board: document.getElementById('game-board'),
        pit: document.getElementById('card-pit'),
        newGame: document.getElementById('new-game'),
        undo: document.getElementById('undo-move'),
        floating: document.getElementById('floating-cards')
    }

    let game = new Game(elems);
    document.addEventListener('mousedown', (e) => {
        game.OnCardDown(e);
    });

    document.addEventListener('mouseup', (e) => {
        game.OnCardUp(e);
    });

    document.addEventListener('mousemove', (e) => {
        game.OnMouseMove(e);
    });

    elems.newGame.onclick = (e) => {
        game.Clear();
        game = new Game(elems);
    }
});

// Can do an extend into game modes
// needs serializable state for undos
class Game {
    static DomParser = new DOMParser();

    static #id_serial = 0;
    static GenerateID() { return (Game.#id_serial++).toString(); }

    #cards = new Map();
    GetCard(id) { return this.#cards.get(id); }
    SetCard(id, card) { this.#cards.set(id, card); }

    #holdingCard = null;
    GetHoldingCard() { return this.#holdingCard; }
    SetHoldingCard(card) { this.#holdingCard = card; }

    #staticStackElems = new Map();
    #cardStacks = new Map();

    #card_pit_obj;
    #click_pos;
    #elems;

    constructor(elems) {
        this.#elems = elems;

        // Ref to stacks
        [...document.getElementsByClassName('card-stack')].forEach((stack) => {
            let stack_obj = new CardStack(stack);
            if(stack.id === 'card-pit') { this.#card_pit_obj = stack_obj; }
            this.#staticStackElems.set(stack_obj.GetID(), stack_obj);
        });

        // 4 suit spider
        let decks = [
            new StandardDeck(0), new StandardDeck(1), new StandardDeck(2), new StandardDeck(3),
            new StandardDeck(0), new StandardDeck(1), new StandardDeck(2), new StandardDeck(3)
        ];
        decks.forEach(deck => {
            let cards = deck.GetCards();
            for(let i = 0; i < cards.length; i++) {
                this.SetCard(cards[i].GetID(), cards[i]);
                elems.pit.appendChild(cards[i].GetElem());
                cards[i].ApplyCurrentPosition();
            }
        });

        // Creates Columns
        for(let i = 0; i < 10; i++) {
            let col = new CardColumn();
            elems.board.appendChild(col.GetElem());
            this.#cardStacks.set(col.GetID(), col);
        }
    }

    Clear() {
        [...this.#cards.values()].forEach((card) => { card.RemoveElem(); });
        [...this.#cardStacks.values()].forEach((stack) => { stack.RemoveElem(); });
    }

    CheckOverlap(card1, card2) {
        let cards = [card1.GetBounds(), card2.GetBounds()];
        if(cards[0].x1 > cards[1].x2 || cards[1].x1 > cards[0].x2)
            return 0;

        if(cards[0].y1 > cards[1].y2 || cards[1].y1 > cards[0].y2)
            return 0;

        const total_area = (cards[0].x2 - cards[0].x1) * (cards[0].y2 - cards[0].y1);
        let x_value = Math.min(cards[0].x2, cards[1].x2) - Math.max(cards[0].x1, cards[1].x1);
        let y_value = Math.min(cards[0].y2, cards[1].y2) - Math.max(cards[0].y1, cards[1].y1);

        return (x_value * y_value)/total_area;
    }

    OnCardDown(event, callback = undefined) {
        if(event.target.dataset.card) { 
            this.#holdingCard = this.GetCard(event.target.dataset.card);
            this.#holdingCard.PickUp(this.#elems.floating);
        }

        // if(this.#holdingCard) { console.log("Clicked Card:", this.#holdingCard); }
        this.#click_pos = { x: event.pageX, y: event.pageY };
    }

    OnCardUp(event, callback = undefined) {
        if(this.#holdingCard === null) { return; }
        
        // do stuff - stack has access to top card
        // let card_arr = [...this.#cards.values()];
        // for(let i = 0; i < card_arr.length; i++) {
        //     if(this.#holdingCard.GetID() === card_arr[i].GetID()) { continue; }
        //     if(this.CheckOverlap(this.#holdingCard, card_arr[i])) {
        //         //console.log(`Overlap: ${this.#holdingCard.GetName()} > ${card_arr[i].GetName()}`);

        //         // get stack if card is in one

        //         i = card_arr.length + 1;
        //     }
        // }

        let stack_arr = [...this.#cardStacks.values()];
        let closest_anchor = null, closest_area = 0;
        // console.log("Stack Array:", stack_arr);
        for(let i = 0; i < stack_arr.length; i++) {
            let overlap_area = this.CheckOverlap(this.#holdingCard, stack_arr[i]);
            // console.log("Overlap:", overlap_area);
            if(overlap_area > 0 && closest_area < overlap_area) {
                closest_anchor = stack_arr[i];
                closest_area = overlap_area;
            }
        }

        if(closest_anchor && closest_anchor.CanAddCard(this.#holdingCard)) {
            this.#holdingCard.Flip(false);
            this.#holdingCard.Drop(closest_anchor.GetElem(), closest_anchor);
            closest_anchor.AddCard(this.#holdingCard);
        } else {
            // return to pile if invalid - specific to game types probably
            // spider for now
            this.#holdingCard.Drop(this.#elems.pit);
            this.#holdingCard.SetPosition(0, 0);
            this.#holdingCard.Move();
        }

        this.#holdingCard.Drop();
        this.#holdingCard = null;
    }

    OnMouseMove(event, callback = undefined) {
        if(this.#holdingCard === null) { return; }
        // console.log("Moved Card:", event);

        this.#holdingCard.Move({ x: event.pageX - this.#click_pos.x, y: event.pageY - this.#click_pos.y });
    }
}

class StandardDeck {
    static Suits = {
        Spades: 0,
        Hearts: 1,
        Diamonds: 2,
        Clubs: 3
    }

    static SuitNames = [
        'Spades', 'Hearts', 'Diamonds', 'Clubs'
    ]

    static SuitIcons = [
        'spade.svg', 'heart.svg', 'diamond.svg', 'club.svg'
    ]

    static CardTypes = {
        Ace: 0,
        Two: 1,
        Three: 2,
        Four: 3,
        Five: 4,
        Six: 5,
        Seven: 6,
        Eight: 7,
        Nine: 8,
        Ten: 9,
        Jack: 10,
        Queen: 11,
        King: 12
    }

    static CardIcons = [
        'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'
    ]

    static CardNames = [
        'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'
    ]

    #suit = undefined;
    GetSuit() { return this.#suit; }
    SetSuit(suit) { this.#suit = suit; }

    #cards = [];
    GetCards() { return [...this.#cards]; }

    constructor(suit) {
        this.#suit = suit;
        this.GenerateCards();
    }

    GenerateCards() {
        for(let i = 0; i < StandardDeck.CardNames.length; i++) {
            this.#cards.push(new StandardCard(this.#suit, i));
        }
    }
}

class StandardCard {
    #elem;
    GetElem() { return this.#elem; }
    SetElem(elem) { this.#elem = elem; }
    RemoveElem() { this.#elem.remove(); }

    #id;
    GetID() { return this.#id; }
    SetID(id) { this.#id = id; }

    #position;
    GetPosition() { return this.#position; }
    SetPosition(x, y) { this.#position = { x, y }; }
    ApplyCurrentPosition() { 
        let p = this.GetBounds();
        this.#position = { x: p.x1, y: p.y1 };
        this.Move({ x: -(p.x1), y: -(p.y1) });
    }

    #name;
    GetName() { return this.#name; }

    constructor(suit, type) {
        this.#name = `${StandardDeck.CardNames[type]} of ${StandardDeck.SuitNames[suit]}`
        this.#id = Game.GenerateID();
        this.#elem = Game.DomParser.parseFromString(`
            <div class="card-elem down" data-card="${this.#id}">
                <div class="card-back"></div>
                <span class="card-data">
                    <p>${StandardDeck.CardIcons[type]}</p>
                    <img src="${StandardDeck.SuitIcons[suit]}"></img>
                </span>
            </div>
        `, 'text/html').body.firstElementChild;

        this.GetInfo = () => {
            return { suit, type }
        }
    }

    GetBounds() {
        let data = this.#elem.getBoundingClientRect();
        return {
            x1: data.left,
            y1: data.top,
            x2: data.right,
            y2: data.bottom
        }
    }

    Move(position = { x: 0, y: 0 }) {
        // console.log("Moving:", position, this.#elem.style);
        let pos = [this.#position.x + position.x, this.#position.y + position.y]
        this.#elem.style.left = pos[0] + 'px';
        this.#elem.style.top = pos[1] + 'px';
    }

    PickUp(parent) {
        this.#elem.classList.add('holding');
        if(parent) { parent.appendChild(this.#elem); }
    
        this.Move();
    }

    // stack will have logic for positioning
    Drop(parent, stack) {
        this.#elem.classList.remove('holding');
        if(parent) { parent.appendChild(this.#elem); }

        // Works for Page Absolut Position, breaks on parenting to column
        if(!stack) {
            let loc = this.GetBounds();
            this.SetPosition(loc.x1, loc.y1);
            return;
        } 

        // use stack logic later
        this.SetPosition(0, 0);
        this.Move();
    }

    Flip(forceUp = undefined) {
        this.#elem.classList.toggle('down', forceUp);
    }
}

class CardStack {
    // single card shown from top
    _id;
    GetID() { return this._id; }
    SetID(id) { this._id = id; }

    _elem;
    GetElem() { return this._elem; }
    SetElem(elem) { this._elem = elem; }
    RemoveElem() { this._elem.remove(); }

    _card_list = [];
    GetTopCard() { return this._card_list.length > 0 ? this._card_list[this._card_list.length - 1] : null; }
    GetCardList() { return this._card_list; }

    constructor(static_elem = undefined) {
        this._id = Game.GenerateID();
        if(!static_elem) {
            let elem = document.createElement('div');
            elem.classList.add('card-stack');
            elem.dataset.stack = this._id;
            this._elem = elem;
        } else {
            static_elem.dataset.stack = this._id;
            this._elem = static_elem;
        }
    }

    GetBounds() {
        let data = this._elem.getBoundingClientRect();
        return {
            x1: data.left,
            y1: data.top,
            x2: data.right,
            y2: data.bottom
        }
    }

    Shuffle() {}

    CanAddCard(card) {
        // sets rules here
        if(this.GetTopCard()) {
            if(card.GetInfo().type + 1 == this.GetTopCard().GetInfo().type)
                return true;

            return false;
        }

        return true;
    }

    AddCard(card) {
        this._card_list.push(card);
    }
}

class CardColumn extends CardStack {
    // solitare type column

    constructor() {
        super();
        this._elem.classList.remove('card-stack');
        this._elem.classList.add('card-column');
    }

    AddCard(card) {
        super.AddCard(card);
        for(let i = 0; i < this._card_list.length; i++) {
            this._card_list[i].SetPosition(0, i * 28);
            this._card_list[i].Move();
        }
    }
}

class SpiderColumn extends CardColumn {

}