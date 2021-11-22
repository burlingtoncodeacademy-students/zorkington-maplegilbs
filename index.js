/*----------Boilerplate----------*/
const readline = require('readline');
const readlineInterface = readline.createInterface(process.stdin, process.stdout);

function ask(questionText) {
  return new Promise((resolve, reject) => {
    readlineInterface.question(questionText, resolve);
  });
}
/*----------End Boilerplate----------*/


/*---------CLASSES----------*/
//---location class
class Location {
  constructor(name, description, exits, inventory = {}, isLocked = false, itemToUnlock = null) {
    this.name = name;
    this.description = description;
    this.exits = exits;
    this.inventory = inventory;
    this.isLocked = isLocked;
    this.itemToUnlock = itemToUnlock;
  }
  inventoryDescription() {
    let invDescpArray = []
    for (let item in this.inventory) {
      invDescpArray.push(this.inventory[item].description);
    }
    invDescpArray[invDescpArray.length - 1] = 'and ' + invDescpArray[invDescpArray.length - 1]
    let invDescpString = ' You look around and see ' + invDescpArray.join(', ');
    if (invDescpArray.length > 0) {
      return invDescpString;
    }
    else { return '' }
  }
  describe() {
    return `${this.description}${this.inventoryDescription()}.`
  }
  unlock(item) {
    if (item === this.itemToUnlock) {
      this.isLocked = false;
    }

  }
}
//---inventory item class
class InventoryItem {
  constructor(name, description, validActions) {
    this.name = name;
    this.description = description;
    this.validActions = validActions;
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
/*---------End Classes----------*/


/*----------FUNCTIONS----------*/
//--prompt user input and turn it into an array, return the array
async function getInput() {
  let answer = await ask('>_')
  answer = answer.split(' ');
  answer = answer.map(textItem => { return textItem.toLowerCase() })
  return answer;
}
//returns to prior location
function goBack() {
  let tempLoc = currentLocation;
  currentLocation = priorLocation;
  priorLocation = tempLoc;
  return currentLocation.describe();
}
//---when given a new location to change to - if the location is a valid exit of the current location, update the current location to be the new location, otherwise notify user it is not a valid option
function changeLocation(newLocation) {
  let newLocationObj = locations[newLocation];
  let isExitValid = false;
  for (let item of currentLocation.exits) {
    if (newLocation === item) {
      isExitValid = true;
      if (newLocationObj.isLocked) {
        let playerHasItemToUnlock = false;
        for (let item in player1.inventory) {
          if (player1.inventory[item].name === newLocationObj.itemToUnlock) {
            playerHasItemToUnlock = true;
          }
        }
        if (playerHasItemToUnlock) {
          return `You try and enter ${newLocation} but it seems to be locked. Maybe the ${newLocationObj.itemToUnlock} would be useful`
        }
        else {
          return `You try and enter ${newLocation} but it seems to be locked.`
        }
      }
      else {
        priorLocation = currentLocation;
        currentLocation = newLocationObj;
        return currentLocation.describe()
      }
    }
  }
  if (!isExitValid) {
    return `Sorry I don't see that (${newLocation}) here.`
  }
}


//given an action and an inventory item, validate chosen action on item
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
  for (let playerItem in player1.inventory) {
    if (playerItem === item) { focusObj = player1; }
  }
  for (let locationItem in currentLocation.inventory) {
    if (locationItem === item) { focusObj = currentLocation };
  }
  //if it doesn't exist notify user
  if (focusObj === null) {
    return `Sorry I don't see that item`;
  }


  //buying chair
  if (currentLocation.name === 'furniture store' && actionVerb === 'acquire' && item === 'chair' && !Object.keys(player1.inventory).includes('envelope')) {
    return `You need money to buy the chair.`
  }

  //stealing keys from bank guard section
  if (currentLocation.name === 'bank' && actionVerb === 'acquire' && item === 'keys' && bank.isGuardAwake) {
    console.log(`Bad choice... You think the guard won't notice but you're no pickpocket.  When you grab for the keys he takes you down.  You hear sirens in the distance.`)
    process.exit();
  }
  else if (currentLocation.name === 'bank' && actionVerb === 'acquire' && item === 'keys' && !bank.isGuardAwake) {
    player1.inventory[item] = bank.inventory.keys;
    player1.inventory[item].description = 'a set of keys from the security guard'
    player1.inventory[item].validActions = ['drop']
    delete focusObj.inventory[item]
    bank.description = bank.description + 'A security guard snores lourly in a comfy chair by the entrance.'
    return `When nobody is looking you quietly slip the keys from the sleeping guard`
  }
  if (currentLocation.name === 'bank' && actionVerb === 'drop' && item === 'chair') {
    bank.isGuardAwake = false;
    bank.inventory['keys'].description = 'a security guard.  He found the chair you left and sat down only to fall sound asleep.  A set of keys dangles from his hip.';
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
}


async function gamePlay() {
  let answerArray = await getInput();
  while (answerArray[0] !== 'quit') {
    let answerString = answerArray.join(' ').toLowerCase();
    let action = answerArray[0];
    let target = answerArray.slice(1).filter(item => { return (item !== 'the' && item !== 'a') }); //target is set as remainder of the answer minus articles 'the' and 'a'
    target = target.join(' ');
    if (answerString === 'look around') {
      console.log('\n' + currentLocation.describe());
      answerArray = await getInput();
    }
    else if (answerString === 'i' || answerString === 'inventory') {
      console.log('\n' + player1.displayInventory());
      answerArray = await getInput();
    }
    else if (answerString === 'go back') {
      console.log('\n' + goBack());
      answerArray = await getInput();
    }
    else if (action === 'enter') {
      console.log('\n' + changeLocation(target));
      answerArray = await getInput();
    }
    else {
      console.log('\n' + validateInvInteraction(action, target));
      answerArray = await getInput();
    }
  }
  process.exit();
}
/*----------End Functions----------*/




let player1 = new Player('Player 1', {}, false)

let envelope = new InventoryItem('envelope', 'a envelope that somebody dropped, there appears to be a bit of cash inside', ['acquire', 'open'])
let keys = new InventoryItem('keys', 'a security guard.  He shifts his weight from foot to foot with a pained look on his face.  He appears to be tired from standing all day.  On his hip is a key ring with a set of keys.', ['acquire']);
let chair = new InventoryItem('chair', 'a chair that looks perfect for getting off weary legs', ['acquire'])

let mainStreet = new Location('main street', 'You are in front of a large bank.  Marble columns line the entrance and people are bustling about.  To the left is a side street, to the right is a furniture store', ['side street', 'furniture store', 'bank'], { 'envelope': envelope })
let sideStreet = new Location('side street', 'You find yourself on a street along the side of the bank, it is pretty quiet here.  There is a clothing store to the left, and an door into the bank that reads "employees only"', ['clothing store', 'main street', 'hallway'], {})
let furnitureStore = new Location('furniture store', 'You are inside the furniture store.  There are some nice comfy chairs in here', ['main street'], { 'chair': chair })
let hallway = new Location('hallway', 'You are inside a well lit hallway.  You can hear the busy bank lobby behind one door, and the side street outside the other.  There is a opening to a break room halfway down the hallway and a set of stairs at the end', ['bank', 'side street', 'break room', 'stairs'], {}, true, 'keys')
let bank = new Location('bank', 'You are inside the bank lobby.  It is big and busy. It smells like money.', ['main street', 'hallway'], { 'keys': keys })
bank.isGuardAwake = true;





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
  'bank': bank
}

let verbs = {
  'acquire': ['take', 'buy', 'steal', 'get'],
  'drop': ['give', 'drop', 'leave'],
  'read': ['read', 'inspect', 'look at'],
  'use': ['use']
}

/*----------End Lookup Tables----------*/


console.log(currentLocation.describe());
gamePlay();