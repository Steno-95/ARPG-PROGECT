/*:
 * @target MZ
 * @plugindesc Add a questlog menu and a quest tracker object to keep track of all active and completed quests
 * @author Stefano Lezzi
 *
 * @command showMessage
 * @text Show Message
 * @desc Displays a message on screen.
 *
 * @arg text
 * @text Message Text
 * @desc The text to display.
 * @type string
 * @default Hello!
 *
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

  PluginManager.registerCommand(PLUGIN_NAME, "showMessage", (args) => {
    const text = args.text || "Hello!";
    // TODO: Implement your command logic here
    console.log(`${PLUGIN_NAME}: ${text}`);
  });

  // TODO: Add your plugin  logic here

  /**********************************************************************/
  ///////  DATA DECLARATION
  ///////////////////////////////////////////////////////////////////////
  Game_System.prototype.setTrackedQuest = function (questId) {
    this._trackedQuestId = questId || null;
  };

  Game_System.prototype.getTrackedQuest = function () {
    return this._trackedQuestId || null;
  };

  Game_System.prototype.clearTrackedQuest = function () {
    this._trackedQuestId = null;
  };

  const Quest = function (
    name,
    description,
    giver,
    questLocation,
    type,
    progress,
    maxProgress,
    ...args
  ) {
    this.name = name;
    this.description = description;
    this.giver = giver;
    this.questLocation = questLocation;
    this.type = type;
  };

  const questTracker = {
    active: [
      {
        id: 0,
        name: "quest1",
        description: "kill 10 rats",
        track: false,
        giver: "X, from Y", //nome npc, località
        progress: 0,
        maxProgress: 10,
        type: "main/secondary/repeatable",
        questLocation: "cave under the inn",
      },
      {
        id: 1,

        name: "quest2",
        description: "kill 10 rats",
        track: false,
        giver: "X",
        progress: 0,
        maxProgress: 10,
        type: "main/secondary/repeatable",
        questLocation: "cave under the inn",
      },
    ],
    complete: [
      {
        id: 2,

        name: "quest3",
        description: "kill 10 rats",
        track: false,
        giver: "X",
        progress: 0,
        maxProgress: 10,
        type: "main/secondary/repeatable",
        questLocation: "cave under the inn",
      },
      {
        id: 3,

        name: "quest4",
        description: "kill 10 rats",
        track: false,
        giver: "X",
        progress: 0,
        maxProgress: 10,
        type: "main/secondary/repeatable",
        questLocation: "cave under the inn",
      },
    ],

    addQuestActive(quest) {
      const copyAct = this.active.map();
      const copyComp = this.active.map();
      quest.id = copyAct.concat(copyComp).length;
      this.active.push(quest);
    },

    addQuestComplete(quest) {
      const copyAct = this.active.map();
      const copyComp = this.active.map();
      quest.id = copyAct.concat(copyComp).length;

      this.complete.push(quest);
    },

    getQuest(index, type = "active") {
      return this[type][index];
    },

    removeQuestActive(index) {
      const quest = this.active.splice(index, 1)[0];
      this.addQuestComplete(quest);
    },
  };

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
    if (this.needsCommand("active")) {
      this.addCommand("Quest Attive", "active");
    }
    if (this.needsCommand("complete")) {
      this.addCommand("Quest Completate", "complete");
    }
  };

  Window_QuestCategory.prototype.needsCommand = function (name) {
    return questTracker[name] && questTracker[name].length > 0;
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
    this._data = questTracker[this._category] || [];
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
    console.log("Tracked:", tracked, "Quest ID:", quest.id);
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

    if (quest) {
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

    //Kill Count
    const progText = `Progresso: ${this._quest.progress}/${this._quest.maxProgress}`;
    this.drawText(progText, x, y, width);
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
