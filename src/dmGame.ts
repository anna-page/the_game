import { isValidElement } from "react";
import { MachineConfig, Action, assign, actions} from "xstate";
const {send, cancel} = actions
import {invoke } from "xstate/lib/actionTypes";
import { mapContext } from "xstate/lib/utils";



function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}

function promptAndAsk(prompt: string, secondPrompt: string, thirdPrompt: string, fourthPrompt: string): MachineConfig<SDSContext, any, SDSEvent> {
    return ({
        initial: 'prompt',
        states: {
            promptFour: {
                entry: say(fourthPrompt),
                on: { ENDSPEECH: 'ask' },
            },
            promptThree: {
                entry: say(thirdPrompt),
                on: { ENDSPEECH: 'ask' },
            },
            promptTwo: {
                entry: say(secondPrompt),
                on: { ENDSPEECH: 'ask' },
            },
            prompt: {
                entry: say(prompt),
                on: { ENDSPEECH: 'ask' },
            },
            ask: {
                entry: [send('LISTEN'), 
                    send('MAXSPEECH', {
                        delay: 5000,
                        id: 'maxsp',
                    })
                ],
                on: {
                    MAXSPEECH: [
                        {
                            cond: (context, event) => context.counter === 0,
                            target: 'promptTwo',
                        },
                        {
                            cond: (context, event) => context.counter === 1,
                            target: 'promptThree',
                        },
                        {
                            cond: (context, event) => context.counter === 2,
                            target: 'promptFour',
                        },
                        {
                            cond: (context, event) => context.counter > 2,
                            target: "#root.dm.init",
                        }
                    ]
                },
            },
        }
    })
}

function getHelp(prompt: string):  MachineConfig<SDSContext, any, SDSEvent> {
    return ({
        initial: 'help',
        states: {
            help: {
                entry: say(prompt),
                on: {ENDSPEECH: 'ask'},
            },
            ask: {
                entry: [
                    send('LISTEN'), 
                    // send('MAXSPEECH', {
                    //     delay: 5000,
                    // })
                ],
            }
        }
    })
}

function one_character_change(new_word: string, old_word: string) {
    var samesies = 0

    for( var i = 0, len = 4; i < len; i++ ) { 
        if (new_word[i] === old_word[i]) {
            samesies += 1
        } 
    }

    if (samesies === 3) {
        return true
    } else {
        return false
    }
}

function computer_move(wordHistory: Array) {
    var last_word = wordHistory[wordHistory.length - 1]
    
    for (var key in grammar) { 
        if ( one_character_change(key, last_word) && !wordHistory.includes(key) ) { 
            return key
        } 
    }

    return false
}

function wordToDefine(grammar: Object){
    var words = Object.keys(dictGrammar)
    return words[Math.floor(Math.random() * words.length)]
}

const grammar: { [index: string]: { valid_word?: string,} } = {
    // "back": {valid_word: "back"},
    // "pack": {valid_word: "pack"},
    // "pace": {valid_word: "pace"},
    // "lace": {valid_word: "lace"},
    "lake": {valid_word: "lake"},
    "fake": {valid_word: "fake"},
    "make": {valid_word: "make"},
    // "mace": {valid_word: "mace"},
    "mice": {valid_word: "mice"},
}

const dictGrammar: {[index: string]: {hard_word?: string,}} = {
    "reticent": {hard_word: "reticent"},
    "pastiche": {hard_word: "pastiche"},
    "pleonasm": {hard_word: "pleonasm"},
    "puce": {hard_word: "puce"},
    "squalor": {hard_word: "squalor"},
    "sanguine": {hard_word: "sanguine"},
    "torrid": {hard_word: "torrid"},
    "viscous": {hard_word: "viscous"},
}

const boolgrammar: {[index: string]: {yes?: boolean, no?:boolean}} = {
    "yes": {yes: true },
    "yep": {yes: true },
    "of course": {yes: true },
    "sure": {yes: true },
    "no": {no: false },
    "no way": {no: false },
    "nope": {no: false },
}

const dictionaryQuery = (query: string) => 
    fetch(new Request(proxyurl+`https://api.dictionaryapi.dev/api/v2/entries/en_GB/${query}`, 
                {headers: { 'Origin': 'http://localhost:3000' }})).then(resp => resp.json())


export const dmMenu: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            initial: "prompt",
            on: { 
                RECOGNISED: [
                    {
                        cond: (context) => context.recResult === 'stop',
                        actions: [cancel('maxsp')],
                        target: 'stop',
                    },
                    {
                        cond: (context) => context.recResult === 'help',
                        actions: [cancel('maxsp')],
                        target: '.help',
                    },
                    {
                        actions: [cancel('maxsp')],
                        target: 'invoke_rasa',
                    }
                ],
            },
            states: {
                hist: {type: 'history', history: 'deep'},
                prompt: {
                    ...promptAndAsk(
                        "Would you like to play a game, or learn a new word?",
                        "Do you want to play a game, or learn a new word?",
                        "Which would you like to do: play a game or learn a new word?",
                        "Please. Tell me whether you'd like to play a game or learn a new word."
                    ),
                },
                help:{
                    ...getHelp("Choose either to play a game or to learn a new word.")
                },
                nomatch: {
                    entry: say("Sorry I didn't catch that"),
                    on: { ENDSPEECH: "prompt" },
                },
            }
        },
        invoke_rasa: {
            invoke: {
                id: 'rasa',
                src: (context, event) => nluRequest(context.recResult),
                onDone: {
                    target: 'answer',
                    actions: [
                        assign((context, event) => { return { intentResult: event.data.intent.name } }),
                        send('RASA_DONE'),
                    ],
                },
                onError: {
                    target: 'welcome',
                    actions: (context,event) => console.log(event.data),
                },
            }
        },
        answer: {
            initial: 'wait',
            on: { 
                RASA_DONE: [{
                    cond: (context: { intentResult: string; }) => "play_a_game" == context.intentResult,
                    actions: (context:SDSContext) => console.log('<< GAME: ' + context.intentResult),
                    target: 'playGame',
                },
                {
                    cond: (context: { intentResult: string; }) => "learn_a_word" == context.intentResult,
                    actions: (context:SDSContext) => console.log('<< LEARN: ' + context.intentResult),
                    target: 'learnWord',
                },
                {
                    actions: [cancel('maxsp')],
                    target: '.nomatch',
                }]
            },
            states:{
                nomatch: {
                    entry: say("Sorry I didn't catch that"),
                    on: { ENDSPEECH: '#root.dm.welcome' },
                },
                wait: {
                    entry: cancel('maxsp'),
                }
            }
        },
        playGame: {
            initial: "confirm_rules",
            on: {
                RECOGNISED: [
                    {
                        cond: (context) => context.recResult === 'stop',
                        target: 'stop',
                    },
                ]
            },
            states: {
                hist: {type: 'history', history: 'deep'},
                confirm_rules: {
                    initial: "prompt",
                    on:{ 
                        RECOGNISED: [
                            {
                                cond: (context) => "yes" in (boolgrammar[context.recResult] || {}),
                                actions: [
                                    cancel('maxsp'), 
                                    assign((context) => { return { confirm: boolgrammar[context.recResult].yes } })
                                ],
                                target: "start_game",
                            },
                            {
                                cond: (context) => "no" in (boolgrammar[context.recResult] || {}),
                                actions: [
                                    cancel('maxsp'),
                                    assign((context) => { return { confirm: boolgrammar[context.recResult].no } })
                                ],
                                target: "explain_rules",
                            },
                            {
                                cond: (context) => context.recResult === 'help',
                                actions: [cancel('maxsp')],
                                target: '.help',
                            },
                            {   cond: (context) => context.recResult !== 'stop',
                                target: ".nomatch",
                            }
                        ]
                    },
                    states: {
                        prompt: {
                            ...promptAndAsk(
                                "Do you already know how to play?",
                                "Do you know how to play?",
                                "Do you already know the rules?",
                                "Do you know how the game works?"
                            )
                        },
                        help: {
                            ...getHelp("Say yes or no")
                        },
                        nomatch: {
                            entry: say("Sorry I didn't catch that"),
                            on: { ENDSPEECH: "prompt" }
                        },
                    },
                },
                start_game: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            {
                                // Word is valid but history does not exist
                                cond: (context) => "valid_word" in (grammar[context.recResult] || {}) && !Array.isArray(context.wordHistory),
                                actions: [
                                    cancel('maxsp'),
                                    assign((context) => {
                                        console.log("Creating history with initial word: " + context.recResult)
                                        return {
                                            wordHistory: [grammar[context.recResult].valid_word],
                                            historyLength: 1,
                                        }
                                    }),
                                    send('USER_SUCCESS'),
                                ],
                            },
                            {
                                // Word is valid and history does exist and word not in history and move valid
                                cond: (context) => "valid_word" in (grammar[context.recResult] || {}) && Array.isArray(context.wordHistory) && !context.wordHistory.includes(context.recResult) && one_character_change(context.recResult, context.wordHistory[context.wordHistory.length - 1]),
                                actions: [
                                    cancel('maxsp'),
                                    assign((context) => {
                                        console.log("Updating history with new word: " + context.wordHistory + ',' + context.recResult)
                                        return {
                                            historyLength: context.wordHistory.push(grammar[context.recResult].valid_word)
                                        }
                                    }),
                                    send('USER_SUCCESS'),
                                ],
                            },
                            {
                                // Word is valid and history does exist and word not in history and move invalid
                                cond: (context) => "valid_word" in (grammar[context.recResult] || {}) && Array.isArray(context.wordHistory) && !context.wordHistory.includes(context.recResult) && !one_character_change(context.recResult, context.wordHistory[context.wordHistory.length - 1]),
                                actions: [
                                    cancel('maxsp'),
                                    assign((context) => {
                                        console.log("Word invalid! " + context.recResult)
                                        return {
                                            wordHistory: undefined
                                        }
                                    })
                                ],
                                target: '.lose_game_spelling',
                            },
                            {
                                cond: (context) => context.recResult === 'help',
                                actions: [cancel('maxsp')],
                                target: '.help',
                            },
                            {
                                // Word is valid and history does exist and word in history
                                cond: (context) => "valid_word" in (grammar[context.recResult] || {}) && Array.isArray(context.wordHistory) && context.wordHistory.includes(context.recResult),
                                actions: [
                                    cancel('maxsp'),
                                    assign((context) => {
                                        console.log("Word has been said before: " + context.recResult)
                                        return {
                                            wordHistory: undefined
                                        }
                                    })
                                ],
                                target: '.lose_game_repetition',
                            },
                            {   
                                cond: (context) => context.recResult !== 'stop',
                                target: ".nomatch",
                            },
                        ],
                        USER_SUCCESS: [
                            {
                                cond: (context) => computer_move(context.wordHistory),
                                actions: [
                                    assign((context) => {
                                        var word = computer_move(context.wordHistory)
                                        console.log("Computer choice: " + word)
                                        if (word) {
                                            return {
                                                computerTurn: word,
                                                historyLength: context.wordHistory.push(grammar[word].valid_word)
                                            }
                                        }
                                    }),
                                ],
                                target: '.take_turn',
                            },
                            {
                                cond: (context) => !computer_move(context.wordHistory),
                                actions: [
                                    assign((context) => {
                                        console.log("The computer loses!")
                                        return {
                                            wordHistory: undefined
                                        }
                                    })
                                ],
                                target: '.accept_defeat',
                            }
                        ]
                    },
                    states: {
                        prompt:{
                            ...promptAndAsk(
                                "Say a four letter word",
                                "Pick a four letter word",
                                "Say a word",
                                "Pick a word"
                            ),
                        },
                        help: {    
                            ...getHelp("Choose a word that is four letters long, differs by only one letter from the previous word, and that has not been said before.")
                        },
                        nomatch: {
                            entry: say("Sorry I didn't catch that"),
                            on: { ENDSPEECH: "prompt" }
                        },
                        lose_game_repetition: {
                            entry: say("That word has been said. Game over. Do not pass go. Do not collect two hundred dollars. Do not quit your day job. You lose."),
                            always: "#root.dm.init",
                        },
                        lose_game_spelling: {
                            entry: say("You fool! That word is not one character different from the last. You lose."),
                            always: "#root.dm.init",
                        },
                        take_turn: {
                            entry: send((context) => ({
                                type: "SPEAK",
                                value: `${context.computerTurn}`,
                            })),
                            on: { ENDSPEECH: "wait_for_user_turn" } 
                        },
                        wait_for_user_turn: {    
                            ...promptAndAsk(
                                "Your go", 
                                "It's your go",
                                "Talk to me.",
                                "One word. Four letters. Say it.",
                            )
                        },
                        accept_defeat: {
                            entry: send((context) => ({
                                type: "SPEAK",
                                value: `Damn. You win. You'll regret this.`
                            })),
                            on: { ENDSPEECH: "#root.dm.init" }       
                        }
                    }
                },
                explain_rules: {
                    entry: say("The way this game works is that you start by saying a four letter word, then we take turns saying other four letter words that differ by just one letter. And remember, no repeating words! Okay, here we go"),
                    on: {ENDSPEECH: "start_game"}
                },
            },
        },
        learnWord: {
            initial: "query",
            states: {
                query:{
                    invoke: {
                        id: 'worddefinition',
                        src: (context) => dictionaryQuery(wordToDefine(dictGrammar)),
                        onDone: {
                            target: 'answer',
                            actions:
                                assign(
                                    (context,event) => {
                                        return {
                                            the_word: event.data[0].word,
                                            definition: event.data[0].meanings[0].definitions[0].definition,
                                        }
                                    }
                                ),
                        },
                        onError: '#root.dm.init',
                    }
                },
                answer:{
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Did you know the word ${context.the_word} means ${context.definition}`,
                    })),
                    on: { ENDSPEECH: '#root.dm.init' } 
                }
            }
        },
        stop: {
            entry: say("Okay, stopping now."),
            always: "init",
        },
    },
})

/* RASA API
 *  */
const proxyurl = "https://cors-anywhere.herokuapp.com/";
const rasaurl = 'https://rasa-nlu-heroku.herokuapp.com/model/parse'
const nluRequest = (text: string) =>
    fetch(new Request(proxyurl + rasaurl, {
        method: 'POST',
        // headers: { 'Origin': 'http://maraev.me' }, // only required with proxy
        body: `{"text": "${text}"}`
    }))
        .then(data => data.json());