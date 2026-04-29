/*:
 * @target MZ
 * @plugindesc Add a questlog menu and a quest tracker object to keep track of all active and completed quests
 * @author Stefano Lezzi
 *
 * @command addQuest
 * @desc Retrive a quest from the database and add it as active in the player quest log.
 * @text Start Quest
 *
 * @arg id
 * @type number
 * @default 0
 *
 * @command updateObjective
 * @text Update Objective
 * @desc Update the objective of the quest specified ID, it takes a questId, objectiveIndex, value
 *
 * @arg questId
 * @desc id of the quest in the json file
 * @type number
 *
 * @arg objectiveIndex
 * @desc the id of the next step in the object array
 * @type number
 *
 * @arg value
 * @desc only needed if it's specified a max progression in the objective, it would be the starting point
 * @type number
 * @help
 * QuestTracker
 *
 * Add a questlog menu and a quest tracker object to keep track of all active and completed quests
 *
 * Usage:
 *   Enable the plugin in Plugin Manager.
 *   Use plugin commands from the Event Editor.
 */

(() => {
  "use strict";

  const PLUGIN_NAME = "QuestTracker";
  const parameters = PluginManager.parameters(PLUGIN_NAME);
  const rawQuests = JSON.parse(parameters["quests"] || "[]");

  function parseQuest(raw) {
    const q = JSON.parse(raw);
    return {
      id: Number(q.id),
      name: q.name,
      description: q.description,
      giver: q.giver,
      questLocation: q.location,
      objectives: JSON.parse(q.objectives || "[]").map((objective) => {
        const obj = JSON.parse(objective);
        return {
          text: obj.text,
          max: Number(obj.max),
          progress: 0,
          done: false,
        };
      }),
    };
  }
  const _DataManager_loadDatabase = DataManager.loadDatabase;

  DataManager.loadDatabase = function () {
    _DataManager_loadDatabase.call(this);
    this.loadDataFile("$dataQuests", "Quests.json");
  };
  const QUEST_DATABASE = rawQuests.map(parseQuest);

  PluginManager.registerCommand(PLUGIN_NAME, "addQuest", (args) => {
    const id = Number(args.id);
    $gameSystem.startQuest(id);
  });

  PluginManager.registerCommand(PLUGIN_NAME, "updateObjective", (args) => {
    const questId = Number(args.questId);
    const objIndex = Number(args.objectiveIndex);
    const value = Number(args.value);

    $gameSystem.updateObjective(questId, objIndex, value);
  });

  /**********************************************************************/
  ///////  DATA DECLARATION
  ///////////////////////////////////////////////////////////////////////
  Game_System.prototype.setupQuestDatabase = function () {
    this._questDatabase = QUEST_DATABASE;
  };

  const _Game_System_initialize = Game_System.prototype.initialize;

  //initialize the quest tracker data
  Game_System.prototype.initialize = function () {
    _Game_System_initialize.call(this);
    this.initQuestSystem();
  };

  //set them to empty before loading from db
  Game_System.prototype.initQuestSystem = function () {
    this._quests = {
      active: [],
      complete: [],
    };
    this.setupQuestDatabase();
  };

  Game_System.prototype.startQuest = function (questId) {
    if (!$dataQuests) return;
    const base = $dataQuests.find((q) => q.id === questId);
    if (!base) return;

    // prevent duplicates
    const alreadyActive = this._quests.active.some((q) => q.id === questId);
    if (alreadyActive) return;

    const quest = {
      id: base.id,
      name: base.name,
      description: base.description,
      giver: base.giver,
      questLocation: base.questLocation,

      objectives: base.objectives.map((obj) => ({
        text: obj.text,
        max: obj.max || 0,
        progress: 0,
        done: false,
      })),
    };

    this._quests.active.push(quest);
  };

  //retrieve contents of the questTracker
  Game_System.prototype.quests = function () {
    return this._quests;
  };

  //add a quest to the _quest.active
  Game_System.prototype.addQuest = function (quest) {
    this._quests.active.push(quest);
  };

  //identify the completed quest in the active array, remove it and push it inside the complete quests array
  Game_System.prototype.completeQuest = function (questId) {
    if (!this._quests) {
      console.error("Quest system not initialized!");
      return;
    }
    const index = this._quests.active.findIndex((q) => q.id === questId);
    if (index >= 0) {
      const quest = this._quests.active.splice(index, 1)[0];
      this._quests.complete.push(quest);
    }
  };

  //retrieve either the active  or complete quests array
  Game_System.prototype.getQuests = function (type) {
    return this._quests[type] || [];
  };

  //memorize the id of the quest that is being tracked at this moment
  Game_System.prototype.setTrackedQuest = function (questId) {
    this._trackedQuestId =
      questId !== undefined && questId !== null ? questId : null;
  };

  //retrieve the ID of the quest currently being tracked
  Game_System.prototype.getTrackedQuest = function () {
    return this._trackedQuestId || null;
  };

  //clear the ID of the quest tracked
  Game_System.prototype.clearTrackedQuest = function () {
    this._trackedQuestId = null;
    console.log(Scene_Map);
  };

  Game_System.prototype.updateObjective = function (questId, index, value) {
    const quest = this._quests.active.find((q) => q.id === questId);
    if (!quest) return;

    const obj = quest.objectives[index];
    if (!obj) return;
    console.log(quest);
    if (obj.max) {
      obj.progress = value;
      obj.done = obj.progress >= obj.max;
    } else {
      obj.done = true;
    }

    // auto complete quest
    if (quest.objectives.every((o) => o.done)) {
      this.completeQuest(questId);
      this.clearTrackedQuest();
      console.log(Window_QuestTracker);
    }
  };

  // const Quest = function (
  //   name,
  //   description,
  //   giver,
  //   questLocation,
  //   type,
  //   objectives,
  //   ...args
  // ) {
  //   this.name = name;
  //   this.description = description;
  //   this.giver = giver;
  //   this.questLocation = questLocation;
  //   this.type = type;
  // };

  // const questTracker = {
  //   active: [
  //     {
  //       id: 1,
  //       name: "quest1",
  //       description: "kill 10 rats",
  //       track: false,
  //       giver: "X, from Y", //nome npc, località
  //       objectives: [
  //         { text: "Talk to the innkeeper", done: true },
  //         { text: "Kill 10 rats", progress: 3, max: 10, done: true },
  //         { text: "Return to the innkeeper", done: false },
  //       ],
  //       type: "main/secondary/repeatable",
  //       questLocation: "cave under the inn",
  //     },
  //     {
  //       id: 2,

  //       name: "quest2",
  //       description: "kill 10 rats",
  //       track: false,
  //       giver: "X",
  //       objectives: [
  //         { text: "Talk to the innkeeper", done: true },
  //         { text: "Kill 10 rats", progress: 3, max: 10, done: false },
  //         { text: "Return to the innkeeper", done: false },
  //       ],
  //       type: "main/secondary/repeatable",
  //       questLocation: "cave under the inn",
  //     },
  //   ],
  //   complete: [
  //     {
  //       id: 3,

  //       name: "quest3",
  //       description: "kill 10 rats",
  //       track: false,
  //       giver: "X",
  //       objectives: [
  //         { text: "Talk to the innkeeper", done: true },
  //         { text: "Kill 10 rats", progress: 3, max: 10, done: true },
  //         { text: "Return to the innkeeper", done: true },
  //       ],
  //       type: "main/secondary/repeatable",
  //       questLocation: "cave under the inn",
  //     },
  //     {
  //       id: 4,

  //       name: "quest4",
  //       description: "kill 10 rats",
  //       track: false,
  //       giver: "X",
  //       objectives: [
  //         { text: "Talk to the innkeeper", done: true },
  //         { text: "Kill 10 rats", progress: 3, max: 10, done: true },
  //         { text: "Return to the innkeeper", done: true },
  //       ],
  //       type: "main/secondary/repeatable",
  //       questLocation: "cave under the inn",
  //     },
  //   ],

  //   updateObjective(questId, objIndex, value) {
  //     const quest = this.active.find((q) => q.id === questId);
  //     if (!quest) return;

  //     const obj = quest.objectives[objIndex];

  //     if (obj.max) {
  //       obj.progress = value;
  //       obj.done = obj.progress >= obj.max;
  //     } else {
  //       obj.done = value;
  //     }

  //     // auto-complete quest
  //     if (quest.objectives.every((o) => o.done)) {
  //       const index = this.active.indexOf(quest);
  //       this.removeQuestActive(index);
  //     }
  //   },
  // };

  //-----------------------------------------------------------------------------
  //Should add the menu button between status and formation

  const _Window_MenuComand_addOriginalCommands =
    Window_MenuCommand.prototype.addOriginalCommands;

  Window_MenuCommand.prototype.addOriginalCommands = function () {
    _Window_MenuComand_addOriginalCommands.call(this);
    this.addCommand("Quest Log", "questLog", true);
  };

  // Scene_Menu
  // The scene class of the menu screen.

  Scene_Menu.prototype.createCommandWindow = function () {
    const rect = this.commandWindowRect();
    const commandWindow = new Window_MenuCommand(rect);
    commandWindow.setHandler("item", this.commandItem.bind(this));
    commandWindow.setHandler("skill", this.commandPersonal.bind(this));
    commandWindow.setHandler("equip", this.commandPersonal.bind(this));
    commandWindow.setHandler("status", this.commandPersonal.bind(this));
    //Should add the questLog button in the menu
    commandWindow.setHandler("questLog", this.commandQuest.bind(this));
    commandWindow.setHandler("formation", this.commandFormation.bind(this));
    commandWindow.setHandler("options", this.commandOptions.bind(this));
    commandWindow.setHandler("save", this.commandSave.bind(this));
    commandWindow.setHandler("gameEnd", this.commandGameEnd.bind(this));
    commandWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(commandWindow);
    this._commandWindow = commandWindow;
  };

  //function to add the quest scene to the stack to show it to the player
  Scene_Menu.prototype.commandQuest = function () {
    SceneManager.push(Scene_QuestLog);
  };

  /********************************************************************/
  //// CREATE NEW SCENE FOR QUEST LOG
  //// Consist of both windows and scenes needed for it
  //-----------------------------------------------------------------------------
  // Window_QuestCategory
  //
  // The window for selecting a category of queston the questlog screens.

  function Window_QuestCategory() {
    this.initialize(...arguments);
  }

  Window_QuestCategory.prototype = Object.create(Window_HorzCommand.prototype);
  Window_QuestCategory.prototype.constructor = Window_QuestCategory;

  Window_QuestCategory.prototype.initialize = function (rect) {
    Window_HorzCommand.prototype.initialize.call(this, rect);
  };

  Window_QuestCategory.prototype.maxCols = function () {
    return 2;
  };

  Window_QuestCategory.prototype.update = function () {
    Window_HorzCommand.prototype.update.call(this);
    if (this._questWindow) {
      this._questWindow.setCategory(this.currentSymbol());
    }
  };

  Window_QuestCategory.prototype.makeCommandList = function () {
    this.addCommand("Quest Attive", "active");
    this.addCommand("Quest Completate", "complete");
  };

  Window_QuestCategory.prototype.setQuestWindow = function (questWindow) {
    this._questWindow = questWindow;
  };

  Window_QuestCategory.prototype.needsSelection = function () {
    return this.maxItems() >= 2;
  };

  //-----------------------------------------------------------------------------
  // Window_QuestList
  //
  // The window for selecting an item on the item screen.

  function Window_QuestList() {
    this.initialize(...arguments);
  }

  Window_QuestList.prototype = Object.create(Window_Selectable.prototype);
  Window_QuestList.prototype.constructor = Window_QuestList;

  Window_QuestList.prototype.initialize = function (rect) {
    Window_Selectable.prototype.initialize.call(this, rect);
    this._category = "none";
    this._data = [];
  };

  Window_QuestList.prototype.setCategory = function (category) {
    if (this._category !== category) {
      this._category = category;
      this.refresh();
      this.scrollTo(0, 0);
    }
  };

  Window_QuestList.prototype.maxCols = function () {
    return 1;
  };

  Window_QuestList.prototype.maxItems = function () {
    return this._data ? this._data.length : 1;
  };

  Window_QuestList.prototype.quest = function () {
    return this.questAt(this.index());
  };

  Window_QuestList.prototype.questAt = function (index) {
    return this._data && index >= 0 ? this._data[index] : null;
  };

  Window_QuestList.prototype.makeQuestList = function () {
    this._data = $gameSystem.getQuests(this._category);
  };

  Window_QuestList.prototype.selectLast = function () {
    this.forceSelect(0);
  };

  Window_QuestList.prototype.drawItem = function (index) {
    const quest = this.questAt(index);
    if (!quest) return;

    const rect = this.itemLineRect(index);
    const tracked = $gameSystem.getTrackedQuest();

    //Evidenzia se tracciata

    if (tracked !== null && quest.id === tracked) {
      this.changeTextColor(ColorManager.textColor(3));
    } else {
      this.changeTextColor(ColorManager.normalColor());
    }

    this.drawText(quest.name, rect.x, rect.y, rect.width);

    //icona
    if (quest.id === tracked) {
      this.drawText("★", rect.x + rect.width - 32, rect.y, 32, "right");
    }

    this.resetTextColor();
  };

  Window_QuestList.prototype.updateHelp = function () {
    const quest = this.quest();
    if (this._detailWindow) {
      this._detailWindow.setQuest(quest);
    }
  };

  Window_QuestList.prototype.refresh = function () {
    this.makeQuestList();
    Window_Selectable.prototype.refresh.call(this);
  };

  Window_QuestList.prototype.processHandling = function () {
    Window_Selectable.prototype.processHandling.call(this);

    if (this.isOpenAndActive()) {
      if (Input.isTriggered("shift")) {
        this.processTrack();
      }
    }
  };

  Window_QuestList.prototype.processTrack = function () {
    const quest = this.quest();
    console.log(quest);
    console.log($gameSystem.getQuests("complete").includes(quest));
    if (quest && !$gameSystem.getQuests("complete").includes(quest)) {
      const current = $gameSystem.getTrackedQuest();

      if (current === quest.id) {
        $gameSystem.clearTrackedQuest(); // toggle OFF
      } else {
        $gameSystem.setTrackedQuest(quest.id); // set nuova
      }

      this.refresh();
      SceneManager._scene._questWindow.refresh();
      SceneManager._scene._questWindow._detailWindow.refresh();
      SoundManager.playOk();
    }
  };

  Window_QuestList.prototype.setDetailWindow = function (window) {
    this._detailWindow = window;
  };

  Window_QuestList.prototype.select = function (index) {
    if (this.index() !== index) {
      Window_Selectable.prototype.select.call(this, index);

      if (this._detailWindow) {
        this._detailWindow.setQuest(this.quest());
      }
    }
  };
  /////////////////////////////////////////////////////////////////////
  // Window_QuestDetail

  function Window_QuestDetail() {
    this.initialize(...arguments);
  }

  Window_QuestDetail.prototype = Object.create(Window_Base.prototype);
  Window_QuestDetail.prototype.constructor = Window_QuestDetail;

  Window_QuestDetail.prototype.initialize = function (rect) {
    Window_Base.prototype.initialize.call(this, rect);
    this._quest = null;
  };
  Window_QuestDetail.prototype.setQuest = function (quest) {
    this._quest = quest;
    this.refresh();
  };

  Window_QuestDetail.prototype.refresh = function () {
    this.contents.clear();

    if (!this._quest) return;

    let x = 0;
    let y = 0;
    const width = this.contents.width;

    //Nome Quest
    this.changeTextColor(ColorManager.systemColor());
    this.drawText(this._quest.name.toUpperCase(), x, y, width);

    y += this.lineHeight();

    const tracked = $gameSystem.getTrackedQuest();
    if (this._quest.id === tracked) {
      this.changeTextColor(ColorManager.textColor(3));
      this.drawText("QUEST ATTIVA", x, y, width);
      y += this.lineHeight();
      this.changeTextColor(ColorManager.normalColor());
    }
    //Giver
    this.changeTextColor(ColorManager.normalColor());
    this.drawText("Da: " + this._quest.giver, x, y, width);

    y += this.lineHeight();

    //Location
    this.drawText("Luogo: " + this._quest.questLocation, x, y, width);

    y += this.lineHeight();

    //Desciption
    this.drawTextEx(this._quest.description, x, y, width);

    y += this.lineHeight() * 5;

    // Objectives

    this.drawText("Obiettivi:", x, y, width);
    y += this.lineHeight();

    //variable to track if we have displayed the next step without displaying all of the steps that compose a quest
    let displayedStepToDo = false;

    //loop the quest object, for each item will display a text
    this._quest.objectives.forEach((obj) => {
      let text = obj.text;

      //if there is a max it will display a current/total text
      if (obj.max) {
        text += ` (${obj.progress}/${obj.max})`;
      }

      //if the step results completed will add the "✔ " icon and draw the text
      if (obj.done) {
        this.changeTextColor(ColorManager.textColor(3));
        text = "✔ " + text;

        this.drawText(text, x + 10, y, width);
        y += this.lineHeight();
      } else {
        //if the next step is not displayed it will draw it and set the variable to true to prevent the logic to draw all the successive step before the current one is completed
        if (!displayedStepToDo) {
          this.changeTextColor(ColorManager.normalColor());
          text = "• " + text;

          this.drawText(text, x + 10, y, width);
          y += this.lineHeight();
          displayedStepToDo = true;
        }
      }
    });
  };

  //-----------------------------------------------------------------------------
  // Scene_Item to rewrite in scene_questlog
  //
  // The scene class of the questlog screen.

  function Scene_QuestLog() {
    this.initialize(...arguments);
  }

  Scene_QuestLog.prototype = Object.create(Scene_ItemBase.prototype);
  Scene_QuestLog.prototype.constructor = Scene_QuestLog;

  Scene_QuestLog.prototype.initialize = function () {
    Scene_ItemBase.prototype.initialize.call(this);
  };

  Scene_QuestLog.prototype.create = function () {
    Scene_ItemBase.prototype.create.call(this);
    this.createQuestDetailWindow();
    this.createCategoryWindow();
    this.createQuestWindow();
  };

  Scene_QuestLog.prototype.createCategoryWindow = function () {
    const rect = this.categoryWindowRect();
    this._categoryWindow = new Window_QuestCategory(rect);
    this._categoryWindow.setHelpWindow(this._helpWindow);
    this._categoryWindow.setHandler("ok", this.onCategoryOk.bind(this));
    this._categoryWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._categoryWindow);
  };

  Scene_QuestLog.prototype.categoryWindowRect = function () {
    const wx = 0;
    const wy = 0;
    const ww = Graphics.boxWidth / 2;
    const wh = this.calcWindowHeight(1, true);
    return new Rectangle(wx, wy, ww, wh);
  };

  Scene_QuestLog.prototype.createQuestWindow = function () {
    const rect = this.questWindowRect();
    this._questWindow = new Window_QuestList(rect);
    this._questWindow.setDetailWindow(this._questDetailWindow);
    this._questWindow.setHelpWindow(this._helpWindow);
    this._questWindow.setHandler("ok", this.onItemOk.bind(this));
    this._questWindow.setHandler("cancel", this.onItemCancel.bind(this));
    this.addWindow(this._questWindow);
    this._categoryWindow.setQuestWindow(this._questWindow);
    if (!this._categoryWindow.needsSelection()) {
      this._questWindow.y -= this._categoryWindow.height;
      this._questWindow.height += this._categoryWindow.height;
      this._questWindow.createContents();
      this._categoryWindow.update();
      this._categoryWindow.hide();
      this._categoryWindow.deactivate();
      this.onCategoryOk();
    }
  };

  Scene_QuestLog.prototype.questWindowRect = function () {
    const wx = 0;
    const wy = this._categoryWindow.y + this._categoryWindow.height;
    const ww = Graphics.boxWidth / 2;
    const wh = Graphics.boxHeight - wy;
    return new Rectangle(wx, wy, ww, wh);
  };

  Scene_QuestLog.prototype.onCategoryOk = function () {
    this._questWindow.activate();
    this._questWindow.selectLast();
  };

  Scene_QuestLog.prototype.onItemOk = function () {
    this._questDetailWindow.setQuest(this._questWindow.quest());

    this._questWindow.activate();
  };

  Scene_QuestLog.prototype.onItemCancel = function () {
    if (this._categoryWindow.needsSelection()) {
      this._questWindow.deselect();
      this._categoryWindow.activate();
    } else {
      this.popScene();
    }
  };

  Scene_QuestLog.prototype.createQuestDetailWindow = function () {
    const rect = this.questWindowDetailRect();
    this._questDetailWindow = new Window_QuestDetail(rect);
    this.addWindow(this._questDetailWindow);
  };

  Scene_QuestLog.prototype.questWindowDetailRect = function () {
    const wx = Graphics.boxWidth / 2;
    const wy = 0;
    const ww = Graphics.boxWidth / 2;
    const wh = Graphics.boxHeight;
    return new Rectangle(wx, wy, ww, wh);
  };
})();

// Window_QuestDetail.prototype.drawProgressBar = function(x, y, width) {
//     const rate = this._quest.progress / this._quest.maxProgress;
//     this.drawGauge(x, y, width, rate, "#00ff00", "#008800");
// }; E chiamarla nel refresh.

const _Scene_Map_CreateAllWindows = Scene_Map.prototype.createAllWindows;

Scene_Map.prototype.createAllWindows = function () {
  _Scene_Map_CreateAllWindows.call(this);
  if ($gameSystem.getTrackedQuest()) {
    this.createQuestTrackerWindow();
  }
};

Scene_Map.prototype.createQuestTrackerWindow = function () {
  const rect = new Rectangle(0, 0, 300, 150);
  this._questTrackerWindow = new Window_QuestTracker(rect);
  this.addWindow(this._questTrackerWindow);
};

function Window_QuestTracker() {
  this.initialize(...arguments);
}

Window_QuestTracker.prototype = Object.create(Window_Base.prototype);
Window_QuestTracker.prototype.constructor = Window_QuestTracker;

Window_QuestTracker.prototype.initialize = function (rect) {
  Window_Base.prototype.initialize.call(this, rect);
  this.refresh();
};

Window_QuestTracker.prototype.update = function () {
  Window_Base.prototype.update.call(this);

  const trackedId = $gameSystem.getTrackedQuest();
  if (this._lastTracked !== trackedId) {
    this._lastTracked = trackedId;
    this.refresh();
  }
};

Window_QuestTracker.prototype.refresh = function () {
  this.contents.clear();

  const trackedId = $gameSystem.getTrackedQuest();
  if (trackedId === null) return;
  const quest = $gameSystem.getQuests("active").find((q) => q.id === trackedId);
  if (!quest) return;

  let x = 0;
  let y = 0;

  //Title
  this.changeTextColor(ColorManager.systemColor());
  this.drawText(quest.name, x, y, this.contents.width);

  y += this.lineHeight();

  //First imcolpete objective
  const obj = quest.objectives.find((objective) => !objective.done);

  if (obj) {
    this.changeTextColor(ColorManager.normalColor());

    let text = obj.text;
    if (obj.max) {
      text += ` (${obj.progress}/${obj.max})`;
    }

    this.drawText(text, x, y, this.contents.width);
  }
};
