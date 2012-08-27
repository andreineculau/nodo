/*jshint node:true, strict:false, onevar:false */
/**
 * Command Line Parser
 * Parses all the actions and options passed in the command line
 *
 * @author Rogério Vicente <rogeriopvl@gmail.com>
 * @license MIT (see LICENSE file)
 */

var fs = require('fs'),
    color = require('colors'),
    List = require('../lib/list'),
    Task = require('../lib/task');

var makeCallback = function(type, id, actionMsg, callback){
    var typeMsg;

    id = id || '';

    if (type === 'task'){
        typeMsg = 'Task #' + id + ' ';
    }
    else if (type === 'list'){
        typeMsg = 'List ' + id + ' ';
    }
    else{
        throw new Error('Unknown type');
    }

    return function(err, result){
        if (err){
            console.log(err.toString().red);
        }
        else if (result.affected > 0){
            if (actionMsg){
                console.log(typeMsg + actionMsg);
            }
            if (callback){
                callback(err, result);
            }
        }
        else if (id){
            console.log(typeMsg + 'does not exist.');
        }
        else{
            console.log('No ' + type + ' identifier specified.');
        }
    };
};

var Command = function(){
    this.list = new List();
    this.task = new Task();
};

Command.prototype.run = function(args){

    args.splice(0, 2); // removing interpreter and file name

    var command = args.shift();
    var major = args.shift();
    var minor = args.length < 1 ? null : args.join(' ');

    if (typeof command === 'undefined' || !command || command === '-h' ||
            command === '--help' || command === 'help'){
        this.showHelp();
        process.exit(0);
    }
    else if (command === '-v' || command === '--version' || command === 'version'){
        this.showVersion();
        process.exit(0);
    }
    else {
        this.delegate(command, major, minor);
    }
};

Command.prototype.delegate = function(command, major, minor){
    var type = (major === 'list') ? 'list' : 'task',
        id = (type === 'list') ? minor : major,
        args = [type, id, major, minor],
        commands = [
            'ls',
            'show',
            'add',
            'done',
            'undo',
            'star',
            'unstar',
            'delete',
            'restore',
            'move'
        ];

    if (commands.indexOf(command)){
        this[command].apply(this, args);
    }
    else if (!isNaN(command)){
        id = command;
        this.show(type, id);
    }
    else{
        return this.showHelp();
    }
};

Command.prototype.show = function(type, id){
    this.task.get(id, makeCallback('task', id, undefined, function(err, result){
        console.log('Task #' + result.row.id);
        console.log('List: ' + result.row.listName);
        console.log('Name: ' + result.row.name);
        console.log('Important: ' + (result.row.important ? 'yes' : 'no'));
        console.log('Notes: ' + (result.row.notes ? result.row.notes : 'none'));
        console.log('Due Date: ' + (result.row.date ? Date(result.row.date) : 'none'));
        console.log('Done: ' + (result.row.done ? 'yes' : 'no'));
        console.log('Done Date: ' + (result.row.done_date ? Date(result.row.done_date) : 'none'));
        console.log('Deleted: ' + (result.row.deleted ? 'yes' : 'no'));
    }));
};

Command.prototype.ls = function(type, id, major, minor){
    if (!major && !minor){
        this.showOverview();
    }
    else if (major === 'lists'){
        this.list.getAll(function(err, result){
            var i;

            if (err){
                console.log(err.toString().red);
            }
            else{
                for (i in result.rows){
                    if (Object.hasOwnProperty.call(result.rows, i)){
                        console.log(result.rows[i].name + ' (' + result.rows[i].totalTasks  + ')');
                    }
                }
            }
        });
    }
    else if (major === 'done'){
        this.task.getDone(minor, function(err, result){
            var i;

            if (err){
                console.log(err.toString().red);
            }
            else if (result.rows.length < 1){
                console.log('No tasks are done yet. Are you slacking?'.yellow);
            }
            else{
                for (i in result.rows){
                    if (Object.hasOwnProperty.call(result.rows, i)){
                        var doneDate = new Date(result.rows[i].done_date * 1000),
                            doneString =
                            '(' + result.rows[i].id + ') ' +
                            result.rows[i].name + ' | ';

                        doneString += result.rows[i].listName.bold + ' | ';
                        doneString += doneDate.getDate() + '/' + (doneDate.getMonth() + 1) + '/';
                        doneString += doneDate.getFullYear();
                        console.log(doneString);
                    }
                }
            }
        });
    }
    else if (major === 'deleted'){
        this.task.getDeleted(minor, function(err, result){
            if (err){
                console.log(err.toString().red);
            }
            else if (!result.rows || result.rows.length < 1){
                console.log('There are no deleted tasks.'.yellow);
            }
            else{
                for (var i in result.rows){
                    if (Object.hasOwnProperty.call(result.rows, i)){
                        console.log('(' + result.rows[i].id + ') ' + result.rows[i].name);
                    }
                }
            }
        });
    }
    else if (major){
        // lets assume its a list name
        this.list.getByName(id, makeCallback('list', id, undefined, function(err, result){
            var i;

            for (var j in result.rows){
                if (Object.hasOwnProperty.call(result.rows, i)){
                    console.log('(' + result.rows[j].id + ') ' + result.rows[j].name);
                }
            }
        }));
    }
    else{
        // alias for show all
        this.showOverview();
    }
};

Command.prototype.add = function(type, id, list_id, task_name){
    if (type === 'list'){
        if (id){
            this.list.add(id, function(err, result){
                if (err){
                    console.log(err.toString().red);
                }
                else if (result.lastId){
                    console.log('Added list ' + id);
                }
                else{
                    console.log('Database did not return.'.red); // TODO change this
                }
            });
        }
        else{
            console.log('List name cannot be empty.'.yellow);
        }
    }
    else{
        var newTask = {
            list: list_id,
            name: task_name
        };
        this.task.add(newTask, function(err, result){
            if (err){
                console.log(err.toString().red);
            }
            else if (result.lastId){
                console.log('Task #' + result.lastId + ' added to list ' + list_id.blue);
            }
            else{
                console.log('Database did not return.'.red); // TODO change this
            }
        });
    }
};

Command.prototype.done = function(type, id){
    this.task.setDone(id, 1, makeCallback('task', id, 'marked as done'));
};

Command.prototype.undo = function(type, id){
    this.task.setDone(id, 0, makeCallback('task', id, 'marked as not done'));
};

Command.prototype.star = function(type, id){
    this.task.setStart(id, 1, makeCallback('task', id, 'marked as important'));
};

Command.prototype.unstar = function(type, id){
    this.task.setStart(id, 0, makeCallback('task', id, 'marked as not important'));
};

Command.prototype.remove = function(type, id){
    this[type].remove(id, makeCallback(type, id, 'deleted'));
};

Command.prototype.restore = function(type, id){
    this[type].remove(id, makeCallback(type, id, 'deleted'));
};

Command.prototype.move = function(type, id, task_id, list_id){
    this.task.move(task_id, list_id, makeCallback('task', task_id, 'moved to list ' + list_id));

};

Command.prototype.showOverview = function(){
    this.task.getToDo(function(err, result){
        if (err){
            console.log(err.toString().red);
        }
        else if (result.rows.length > 0){
            var i,
                currentList = null;

            for (i in result.rows){
                if (Object.hasOwnProperty.call(result.rows, i)){
                    if (currentList !== result.rows[i].listName){
                        currentList = result.rows[i].listName;
                        console.log(result.rows[i].listName.bold.underline + ':'.bold.underline);
                    }
                }
                var taskStr = '(' + result.rows[i].id + ') ' + result.rows[i].name;
                if (result.rows[i].important === 1){
                    console.log(taskStr.yellow + ' ★'.yellow);
                }
                else{
                    console.log(taskStr);
                }
            }
        }
        else{
            console.log('Nothing to show.');
        }
    });
};

Command.prototype.showHelp = function(){
    var log = console.log;

    log('Usage: nodo <action> [arguments]');
    log('');
    log('  Available actions and options:');
    log('    nodo ls                          Show all lists and tasks todo');
    log('    nodo ls lists                    Show all lists and number of tasks in each one.');
    log('    nodo ls <list_name>              Show content of list');
    log('    nodo ls done                     Show all done tasks');
    log('    nodo ls done <n>                 Show the last n done tasks');
    log('    nodo ls deleted                  Show all deleted tasks');
    log('');
    log('    nodo <task_id>                   Show details of a task');
    log('');
    log('    nodo add <task_name>             Add a new task to default list');
    log('    nodo add <list_name> <task_name> Add a new task to list');
    log('    nodo add list <list_name>        Add a new list');
    log('');
    log('    nodo done <task_id>              Mark a task as done');
    log('    nodo undo <task_id>              Mark a task as not done');
    log('');
    log('    nodo star <task_id>              Star a task (will display with different color)');
    log('    nodo unstar <task_id>            Unstar a task');
    log('');
    log('    nodo delete <task_id>            Delete task');
    log('    nodo delete list <list_name>     Delete list');
    log('');
    log('    nodo restore <task_id>           Restore task');
    log('    nodo restore list <list_name>    Restore list');
    log('');
    log('    nodo move <task_id> <list_name>  Moves a task to a list');
};

Command.prototype.showVersion = function(){
    var log = console.log,
        nodoVersion = require('../lib/config').version;

    log('');
    log("d8b   db  .d88b.  d8888b.  .d88b.");
    log("888o  88 .8P  Y8. 88  `8D .8P  Y8.");
    log("88V8o 88 88    88 88   88 88    88");
    log("88 V8o88 88    88 88   88 88    88");
    log("88  V888 `8b  d8' 88  .8D `8b  d8");
    log("VP   V8P  `Y88P'  Y8888D'  `Y88P\n");
    log('The Simple Command Line Task Manager');
    log('\nVersion '.magenta + nodoVersion.green);
    log('');
};

module.exports = Command;
