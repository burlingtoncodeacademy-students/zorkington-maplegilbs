/*----------Boilerplate----------*/
const { SIGXCPU } = require('constants');
const { findSourceMap } = require('module');
const readline = require('readline');
const { serialize } = require('v8');
const readlineInterface = readline.createInterface(process.stdin, process.stdout);

function ask(questionText) {
  return new Promise((resolve, reject) => {
    readlineInterface.question(questionText, resolve);
  });
}

/*---------CLASSES----------*/
//---location class
class Location {
  constructor(name, description, exits, inventory = {}, isLocked = false, itemToUnlock = null, isSecure = false) {
    this.name = name;
    this.description = description;
    this.exits = exits;
    this.inventory = inventory;
    this.isLocked = isLocked;
    this.itemToUnlock = itemToUnlock;
    this.isSecure = isSecure;
  }
  inventoryDescription() {
    let invDescpArray = []
    for (let item in this.inventory) {
      invDescpArray.push(this.inventory[item].description);
    }
    if (invDescpArray.length > 1) {
      invDescpArray[invDescpArray.length - 1] = 'and ' + invDescpArray[invDescpArray.length - 1]
    };
    let invDescpString = ' You look around and see ' + invDescpArray.join(', ');
    if (invDescpArray.length > 0) {
      return invDescpString + '.';
    }
    else { return '' }
  }
  describe() {
    return `${this.description}${this.inventoryDescription()}`
  }
  unlock(item) {
    if (item === this.itemToUnlock) {
      this.isLocked = false;
    }

  }
}
//---inventory item class
class InventoryItem {
  constructor(name, description, validActions, readDetails) {
    this.name = name;
    this.description = description;
    this.validActions = validActions;
    this.readDetails = readDetails
  }
}
//---player class
class Player {
  constructor(name, inventory, isDisguised) {
    this.name = name;
    this.inventory = inventory;
    this.isDisguised = isDisguised;
  }
  displayInventory() {
    let invDescrip = [];
    if (Object.keys(this.inventory).length === 0) {
      return 'You have nothing in your inventory.'
    }
    else {
      for (let item in this.inventory) {
        invDescrip.push(this.inventory[item].description)
      }
      return `You have the following items: \n${invDescrip.join('\n')}.`
    }
  }
}

/*----------FUNCTIONS----------*/
//prompt user input and turn it into an array, return the array
async function getInput(promptText = '>_') {
  let answer = await ask(promptText)
  answer = answer.split(' ');
  answer = answer.map(textItem => { return textItem.toLowerCase() })
  return answer;
}

//returns to prior location by way of swapping current location object and prior location object
function goBack() {
  let tempLoc = currentLocation;
  currentLocation = priorLocation;
  priorLocation = tempLoc;
  return currentLocation.describe();
}

//wrap output text to max of 80 char per line, only wrap on whitespace characters
function wordWrapCLog(inputText) {
  let textArray = [];
  let startIndex = 0;
  while (inputText.length - startIndex > 80) {
    let chunkOfText = inputText.slice(startIndex, startIndex + 81); //cut a chunk of text 80 chars long from the inputText string, starting at the startIndex
    if (chunkOfText.includes('\n')) { //if that chunk of text contains a line break
      let lineBreakIndex = chunkOfText.indexOf('\n') //find the index of the line break
      textArray.push(chunkOfText.slice(0, lineBreakIndex)) //push a slice of that chunk of text from the beginning to the first line break to the text array
      startIndex += lineBreakIndex+1; //update the start index by the amount of characters that were sliced off in the previous step and repeat the process
    }
    else {
      let finalWSIndex = chunkOfText.lastIndexOf(' ');  //from within that chunk of text, find the index of the final whitespace character
      textArray.push(chunkOfText.slice(0, finalWSIndex + 1)) //push a slice of that chunk of text from the beginning to that white space character to the text array
      startIndex += finalWSIndex + 1; //update the start index by the amount of characters that were sliced off in the previous step and repeat the process
    }
  }
  textArray.push(inputText.slice(startIndex))
  console.log(textArray.join('\n'))
}

//dealing with a locked location.  if user inputs enter command, return that to calling function (to potentially move location), if user unlocks the new location move into that location, else deal with other commands as usual  
async function unlock(newLocation) {
  let newLocationObj = locations[newLocation]
  let playerHasItemToUnlock = false;
  for (let item in player1.inventory) {
    if (player1.inventory[item].name === newLocationObj.itemToUnlock) {
      playerHasItemToUnlock = true;
    }
  }
  if (playerHasItemToUnlock) {
    wordWrapCLog(`\nYou try and enter ${newLocation} but it seems to be locked. Maybe the ${newLocationObj.itemToUnlock} would be useful`)
    let answerArray = await getInput();
    while (answerArray[0] !== 'enter') { 
      let answerString = answerArray.join(' ').toLowerCase();
      let action = answerArray[0];
      let target = answerArray.slice(1).filter(item => { return (item !== 'the' && item !== 'a') }); //target is set as remainder of the answer minus articles 'the' and 'a'
      target = target.join(' ');
      if (verbs['use'].includes(action) && target === newLocationObj.itemToUnlock) {
        wordWrapCLog(`You use the ${target} to unlock the ${newLocation}`)
        newLocationObj.isLocked = false;
        return await changeLocation(newLocation)
      }
      else {
        if (answerString === 'look around') {
          wordWrapCLog('\n' + currentLocation.describe());
        }
        else if (answerString === 'i' || answerString === 'inventory') {
          wordWrapCLog('\n' + player1.displayInventory());
        }
        else if (answerString === 'go back') {
          wordWrapCLog('\n' + goBack());
        }
        else {
          wordWrapCLog('\n' + validateInvInteraction(action, target));
        }
        answerArray = await getInput();
      }
    }
    return answerArray;
  }
  else {
    wordWrapCLog(`\nYou try and enter ${newLocation} but it seems to be locked.`)
    return await getInput();
  }
}

//when given a new location to change to - if the location is a valid exit of the current location, update the current location to be the new location, otherwise notify user it is not a valid option, deal with a locked location via the unlock function
async function changeLocation(newLocation) {
  let newLocationObj = locations[newLocation];
  if (currentLocation.exits.includes(newLocation)) {
    if (newLocation === 'safe') {
     await crackSafe();
    }
    if (newLocationObj.isLocked) {
      return unlock(newLocation)
    }
    else if (!player1.isDisguised && newLocationObj.isSecure) {
      wordWrapCLog(`\nYou step into the ${newLocation} and are startled by two bank employees.  They look you over in your street clothes and are immediately suspicious.  \n "Who are you and how did you get in here?" they ask.\n"I...I.. " you begin to stammer, but its too late, one has already triggered the alarm.  You hear sirens in the distance...`)
      process.exit()
    }
    else {
      priorLocation = currentLocation;
      currentLocation = newLocationObj;
      wordWrapCLog('\n' + currentLocation.describe());
      if (currentLocation === safe) {
        wordWrapCLog('\nYou have reached the end of the game, good work.  Thanks for playing!');
        process.exit()
      }
      return await getInput();
    }
  }
  else {
    wordWrapCLog(`\nSorry I don't see that (${newLocation}) here.`);
    return await getInput();
  }
}

// safe cracking function prompt user for number and spin direction 3 times.  if the combination is 24r42l11r unlock the safe, otherwise remain locked
async function crackSafe() {
  wordWrapCLog(`\nYou step to the safe and crack your knuckles.  All those times opening your high school locker should come in helpful. `);
  let safeCombo = ''
  for (let i = 0; i < 3; i++) {
    let spinTry = ['First', 'Second', 'Third'];
    let spinNum =  await ask(`${spinTry[i]} number: `);
    while (isNaN(parseInt(spinNum))) {
      spinNum =  await ask('Please enter a number: ');
    }
    spinDir = await ask('Direction left (l) or right (r): ')
    spinDir = spinDir.toLowerCase();
    while (spinDir !== 'l' && spinDir !== 'r') {
      spinDir = await ask(`You must spin the dial left (l) or right (r): `)
      spinDir = spinDir.toLowerCase();
    }
    safeCombo += spinNum + spinDir;
  }
  if (safeCombo === '24r42l11r') {
    wordWrapCLog('As the dial hits 11 you hear a satisfying \'CLICK\'.  Suddenly the door begins to swing open.')
    safe.isLocked = false;
  }
  else {
    wordWrapCLog('You stop the dial on your final number.  Nothing happens...')
  }
}

//given an action and an inventory item, validate chosen action on item.  once validated call deal with action if special circumstance or call inventory action function to handle
function validateInvInteraction(action, item) {
  // is it any of the allowable actions
  let actionVerb = '';
  for (let verb in verbs) {
    if (verbs[verb].includes(action)) {
      actionVerb = verb;
    }
  }
  if (actionVerb.length <= 0) {
    return `Sorry I don't know ${action}`;
  }
  //does the item exist in player or location inventory, if so set focusObj equal to whichever object it exists in
  let focusObj = null;
  if (Object.keys(player1.inventory).includes(item)) {
    focusObj = player1;
  }
  else if (Object.keys(currentLocation.inventory).includes(item)) {
    focusObj = currentLocation;
  }
  else {
    return `Sorry I don't see that item`;
  }
  
  //Special circumstances
  
  //buying chair or clothes
  if (currentLocation.name === 'furniture store' && actionVerb === 'acquire' && item === 'chair' && !Object.keys(player1.inventory).includes('envelope')) {
    return `You need money to buy the chair.`
  }
  if (currentLocation.name === 'clothing store' && actionVerb === 'acquire' && item === 'clothes' && !Object.keys(player1.inventory).includes('envelope')) {
    return `You need money to buy clothes.`
  }
  if (currentLocation.name === 'clothing store' && actionVerb === 'acquire' && item === 'clothes' && Object.keys(player1.inventory).includes('envelope')) {
    player1.isDisguised = true;
    delete clothingStore.inventory['clothes'];
    return `After paying the cashier you step into the changing room and put on the new outfit.`
  }
  
  //stealing keys from bank guard section
  if (currentLocation.name === 'bank' && actionVerb === 'acquire' && item === 'keys' && bank.isGuardAwake) {
    wordWrapCLog(`Bad choice... You think the guard won't notice but you're no pickpocket.  When you grab for the keys he takes you down.  You hear sirens in the distance.`)
    process.exit();
  }
  else if (currentLocation.name === 'bank' && actionVerb === 'acquire' && item === 'keys' && !bank.isGuardAwake && !Object.keys(player1.inventory).includes('keys')) {
    player1.inventory[item] = bank.inventory.keys;
    player1.inventory[item].description = 'a set of keys from the security guard'
    player1.inventory[item].validActions = ['drop']
    delete focusObj.inventory[item]
    bank.description = bank.description + ' A security guard snores loudly in a comfy chair by the entrance.'
    return `When nobody is looking you quietly slip the keys from the sleeping guard`
  }
  if (currentLocation.name === 'bank' && actionVerb === 'drop' && item === 'chair') {
    bank.isGuardAwake = false;
    bank.inventory['keys'].description = 'a security guard.  He found the chair you left and sat down only to fall sound asleep.  A set of keys dangles from his hip';
    delete player1.inventory[item];
    return 'You set the chair down by the security guard and ask him to watch it for you.'
  }

  let possibleActions = focusObj.inventory[item].validActions;
  if (!possibleActions.includes(actionVerb)) {
    return `Sorry you can't ${action} ${item}`;
  }
  invInteraction(actionVerb, focusObj, item);
  return `You ${action} the ${item}`
}

//deal with acquiring, dropping and reading inventory items
function invInteraction(action, focusObj, item) {
  if (action === 'acquire') {
    player1.inventory[item] = focusObj.inventory[item];
    player1.inventory[item].validActions[player1.inventory[item].validActions.indexOf(action)] = 'drop'
    delete focusObj.inventory[item];
  }
  if (action === 'drop') {
    currentLocation.inventory[item] = focusObj.inventory[item];
    currentLocation.inventory[item].validActions[currentLocation.inventory[item].validActions.indexOf(action)] = 'acquire'
    delete focusObj.inventory[item];
  }
  if (action === 'read') {
    wordWrapCLog(`You inspect the ${item} more closely.  It reads \n\n ${focusObj.inventory[item].readDetails}.`)
  }
}

//primary game play function, takes input and calls functions to execute commands
async function gamePlay() {
  let answerArray = await getInput();
  while (answerArray[0] !== 'quit') {
    let answerString = answerArray.join(' ').toLowerCase();
    let action = answerArray[0];
    let target = answerArray.slice(1).filter(item => { return (item !== 'the' && item !== 'a') }); //target is set as remainder of the answer minus articles 'the' and 'a'
    target = target.join(' ');
    if (action !== 'enter') {
      if (answerString === 'look around') {
        wordWrapCLog('\n' + currentLocation.describe());
      }
      else if (answerString === 'i' || answerString === 'inventory') {
        wordWrapCLog('\n' + player1.displayInventory());
      }
      else if (answerString === 'go back') {
        wordWrapCLog('\n' + goBack());
      }
      else {
        wordWrapCLog('\n' + validateInvInteraction(action, target));
      }
      answerArray = await getInput();
    }
    else {
      answerArray = await changeLocation(target);
    }
  }
  process.exit();
}


/*---------Initialize Objects----------*/
//player
let player1 = new Player('Player 1', {}, false)
//inventory items
let envelope = new InventoryItem('envelope', 'an envelope that somebody dropped, there appears to be a bit of cash inside', ['acquire'])
let keys = new InventoryItem('keys', 'a security guard.  He shifts his weight from foot to foot with a pained look on his face.  He appears to be tired from standing all day.  On his hip is a key ring with a set of keys', ['acquire']);
let chair = new InventoryItem('chair', 'a chair that looks perfect for getting off weary legs', ['acquire'])
let clothes = new InventoryItem('clothes', 'a familiar outfit comprised of a collared white shirt, creased dress pants and a vest that looks just your size', ['acquire'])
let badge = new InventoryItem('badge', 'an employee badge somebody accidentally left behind', ['acquire'])
let note = new InventoryItem('note', 'a note somebody scribbled to themselves', ['read'], '4 factorial, answer to ultimate question of life, number of Colonel\'s secret herbs and spices ')
//locations
let mainStreet = new Location('main street', 'You are on main street in front of a large bank.  Marble columns line the entrance and people are bustling about.  To the left is a side street, to the right is a furniture store.', ['side street', 'furniture store', 'bank'], { 'envelope': envelope })
let furnitureStore = new Location('furniture store', 'You are inside the furniture store.  There are some nice comfy chairs in here.  The door you came in leads back out to main street.', ['main street'], { 'chair': chair })
let bank = new Location('bank', 'You are inside the bank lobby.  It is big and bright, the noise of business transactions echo off marble walls and floors. There are several tellers busy behind the counter.  They are sharply dressed in pressed dress pants, collared white shirts and tailored vests.  There are large glass doors leading to main street and a door by the teller counter oddly labeled \'hallway\'.', ['main street', 'hallway'], { 'keys': keys }, false, null, false)
bank.isGuardAwake = true;
let hallway = new Location('hallway', 'You are inside a well lit hallway.  You can hear the busy bank lobby behind one door.  There is a opening to a break room halfway down the hallway and a set of stairs at the end, the side entrance is behind yet another door at the opposite end of the hallway.', ['bank', 'side entrance', 'break room', 'stairs'], {}, true, 'keys')
let sideStreet = new Location('side street', 'You find yourself on a street along the side of the bank, it is pretty quiet here.  There is a clothing store to the left, and a side entrance into the bank that reads "employees only", main street can be heard loudly around the corner.', ['clothing store', 'main street', 'side entrance'], {})
let clothingStore = new Location('clothing store', 'You are inside the clothing store.  The door behind you leads back out to the side street.  It is mostly dress clothes and fancy hats.', ['side street'], { 'clothes': clothes })
let sideEntrance = new Location('side entrance', 'You are standing in a small entry area.  There is a camera pointed at the door.  There are two doors, one to the side street, the other to a hallway.', ['side street', 'hallway'], {}, true, 'keys', true)
let stairs = new Location('stairs', 'You are in a stairwell leading from the hallway down to the safe room.', ['hallway', 'safe room'], {}, false, null, true);
let breakRoom = new Location('break room', 'You are in a simple breakroom for the bank employees.  The entrance to the hallway is behind you.  Two tellers sit eating lunch at a table.  They seem to be having a disagreement.  \'No its Right, Left, Right\' you overhear.', ['hallway'], { 'badge': badge }, false, null, true);
let safeRoom = new Location('safe room', 'You have arrived at the safe room.  Behind you is a door leading to the stairs, in front of you is the imposing metal door of the safe.  It is circular and perhaps 8 feet in diameter. In the center of the door is a small combination dial.', ['stairs', 'safe'], { 'note': note }, true, 'badge', true)
let safe = new Location('safe', 'You did it, you can\'t believe it.  You are inside the safe.  Money is stacked from the floor to ceiling.  Oh my god you forgot to bring a bag....', ['safe room'], {}, true, 244211, true)

/*-----Initialize Game Configuration And Begin Gameplay-----*/
let locationsArray = [mainStreet, mainStreet]
let currentLocation = locationsArray[1];
let priorLocation = locationsArray[0];

/*----------LOOKUP TABLES----------*/
let locations = {
  'main street': mainStreet,
  'side street': sideStreet,
  'furniture store': furnitureStore,
  'hallway': hallway,
  'bank': bank,
  'clothing store': clothingStore,
  'side entrance': sideEntrance,
  'stairs': stairs,
  'break room': breakRoom,
  'safe room': safeRoom,
  'safe': safe
}
let verbs = {
  'acquire': ['take', 'buy', 'steal', 'get'],
  'drop': ['give', 'drop', 'leave'],
  'read': ['read', 'inspect', 'look at'],
  'use': ['use', 'try', 'input']
}

/*---------Begin GamePlay----------*/
wordWrapCLog("Welcome to .... THE HEIST....")
wordWrapCLog("To play the game move from location to location using the 'enter' command followed by the desired location. To return to the previous location enter 'go back'. Use the 'look around' command to inspect the current location. You may take and drop items you see along the way. At any point check you inventory by typing 'i' or 'inventory'.\n\n Good Luck.\n");
wordWrapCLog(currentLocation.describe());
gamePlay();