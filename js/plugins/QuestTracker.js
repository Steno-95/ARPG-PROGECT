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
 * @arg variableId
 * @desc only needed if it's specified a max progression in the objective, it would be the starting point
 * @type variable
 * @default 0
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
      repeatable: q.repeatable || false,
      type: q.type || "secondary",
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
    const varId = args.variableId;

    $gameSystem.updateObjective(questId, objIndex, varId);
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
    const alreadyActive =
      this._quests.active.some((q) => q.id === questId) ||
      this._quests.complete.some((q) => q.id === questId);
    if (alreadyActive) return;

    const quest = {
      id: base.id,
      name: base.name,
      repeatable: base.repeatable || false,
      type: base.type || "secondary",
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

    this.addQuest(quest);
    this.setTrackedQuest(quest.id);
    const scene = SceneManager._scene;
    //might become a BUG
    //logically should display the quest tracker window in the moment you accept a new quest
    if (!scene._questTrackerWindow) scene.createQuestTrackerWindow();
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
      if (!quest.repeatable) this._quests.complete.push(quest);

      // 👇 IMPORTANT: untrack if this was the tracked quest
      if (this._trackedQuestId === questId) {
        this.clearTrackedQuest();
      }
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
  };

  Game_System.prototype.updateObjective = function (questId, index, varId) {
    const quest = this._quests.active.find((q) => q.id === questId);
    if (!quest) return;
    const obj = quest.objectives[index];
    if (!obj) return;
    if (obj.max) {
      obj.progress = $gameVariables.value(varId);
      obj.done = obj.progress >= obj.max;
    } else {
      obj.done = true;
    }

    // auto complete quest
    if (quest.objectives.every((o) => o.done)) {
      this.completeQuest(questId);
      this.clearTrackedQuest();
    }
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
    this.setCursorRect(0, 0, 0, 0);
    this._category = "none";
    this._data = [];
  };

  //check if the current item selected is a header or not
  Window_QuestList.prototype.isHeader = function (index) {
    const item = this.questAt(index);
    return item && item.header;
  };

  //read movement downwards
  Window_QuestList.prototype.cursorDown = function (wrap) {
    let index = this.index();

    do {
      index++;

      if (index >= this.maxItems()) {
        if (wrap) {
          index = 0;
        } else {
          index = this.maxItems() - 1;
          break;
        }
      }
    } while (this.isHeader(index));

    this.select(index);
  };

  //read movement upwards
  Window_QuestList.prototype.cursorUp = function (wrap) {
    let index = this.index();

    do {
      index--;

      if (index < 0) {
        if (wrap) {
          index = this.maxItems() - 1;
        } else {
          index = 0;
          break;
        }
      }
    } while (this.isHeader(index));

    this.select(index);
  };

  //remove the background from each quest title in the list
  Window_QuestList.prototype.drawItemBackground = function (index) {
    // Do nothing
  };

  Window_QuestList.prototype.refreshCursor = function () {
    if (this.index() < 0) {
      this.setCursorRect(0, 0, 0, 0);
      return;
    }

    const item = this.questAt(this.index());

    // Hide cursor on headers
    if (item && item.header) {
      this.setCursorRect(0, 0, 0, 0);
      return;
    }

    const rect = this.itemRect(this.index());

    // Slight inset for cleaner UI
    this.setCursorRect(rect.x + 4, rect.y + 2, rect.width - 8, rect.height - 4);
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
    const quest = this.questAt(this.index());
    return quest && !quest.header ? quest : null;
  };

  Window_QuestList.prototype.questAt = function (index) {
    return this._data && index >= 0 ? this._data[index] : null;
  };

  Window_QuestList.prototype.makeQuestList = function () {
    // this._data = $gameSystem.getQuests(this._category);
    this._data = [];

    //ottieni le quest attive correnti con l'API call
    const quests = $gameSystem.getQuests(this._category);

    //estrai tutte le quest primarie
    const mainQuests = quests.filter((q) => q.type === "main");

    //estrai tutte le quest secondarie eccetto le ripetibili
    const secondaryQuests = quests.filter(
      (q) => q.type === "secondary" && !q.repeatable,
    );

    //estrae le quest ripetibili
    const repeatableQuests = quests.filter((q) => q.repeatable);

    //se c'è delle quest primarie, crea il primo elemento come titolo e poi aggiungi le quest primarie
    if (mainQuests.length > 0) {
      this._data.push({
        header: true,
        title: "Principali",
      });

      this._data.push(...mainQuests);
    }

    //se c'è delle quest secondarie, crea l'elemento con il titolo e poi aggiungi le quest secondarie
    if (secondaryQuests.length > 0) {
      this._data.push({
        header: true,
        title: "Secondarie",
      });

      this._data.push(...secondaryQuests);
    }
    //se c'è delle ripetibili, crea l'header for le ripetibili e poi aggiunge le quest ripetibili
    if (repeatableQuests.length > 0) {
      this._data.push({
        header: true,
        title: "Ripetibili",
      });

      this._data.push(...repeatableQuests);
    }
  };

  //per rendere i titoli dei raggruppamenti non interagibili
  Window_QuestList.prototype.isEnabled = function (item) {
    return item && !item.header;
  };

  Window_QuestList.prototype.isCurrentItemEnabled = function () {
    return this.isEnabled(this.quest());
  };

  Window_QuestList.prototype.selectLast = function () {
    this.forceSelect(0);
  };

  Window_QuestList.prototype.drawItem = function (index) {
    const quest = this.questAt(index);
    if (!quest) return;

    const rect = this.itemLineRect(index);

    //HEADER
    if (quest.header) {
      //define the color based on which header is it
      const color =
        quest.title === "Principali"
          ? 5
          : quest.title === "Secondarie"
            ? 12
            : 10;
      //change title color
      this.changeTextColor(ColorManager.textColor(color));
      this.contents.fontBold = true;
      this.contents.fontSize = 20;

      this.drawText(quest.title, rect.x, rect.y, rect.width);

      this.contents.fontBold = false;
      this.resetFontSettings();
      this.resetTextColor();

      //change underline color
      this.contents.paintOpacity = 255;
      this.contents.fillRect(
        rect.x,
        rect.y + rect.height - 2,
        rect.width,
        2,
        ColorManager.textColor(3),
      );
      return;
    }

    //NORMAL QUEST
    const tracked = $gameSystem.getTrackedQuest();

    //Evidenzia se tracciata

    this.contents.fontSize = 17;
    if (tracked !== null && quest.id === tracked) {
      this.changeTextColor(ColorManager.textColor(3));
    } else {
      this.changeTextColor(ColorManager.normalColor());
    }

    const linesTitle = wrapText(quest.name, rect.width, this);
    linesTitle.forEach((line, i) => {
      this.drawText(
        `${quest.id === tracked ? "★ " : "• "}` + line.trim(),
        rect.x + 10,
        rect.y,
        rect.width,
      );
      if (linesTitle.length > i + 1) y += this.lineHeight() / 1.5;
    });

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

  //aggiunge hover behavior a le quest e lo rimuove dai raggruppamenti
  Window_QuestList.prototype.select = function (index) {
    // if (this.index() !== index) {
    // Window_Selectable.prototype.select.call(this, index);

    // if (this._detailWindow) {
    // this._detailWindow.setQuest(this.quest());
    // }
    // }
    Window_Selectable.prototype.select.call(this, index);

    const item = this.quest();

    if (item && item.header) {
      if (index < this.maxItems() - 1) {
        this.select(index + 1);
      }
    }

    if (this._detailWindow && item && !item.header) {
      this._detailWindow.setQuest(item);
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
    const MAX_WIDTH = Graphics.boxWidth / 2 - 10;
    const GAP_TEXT = 1.5;
    const GAP_BLOCKS = 0.8;

    //Nome Quest
    this.contents.fontSize = 21;
    const linesTitle = wrapText(
      this._quest.name.toUpperCase(),
      MAX_WIDTH,
      this,
    );

    linesTitle.forEach((line, i) => {
      this.changeTextColor(ColorManager.systemColor());
      this.drawText(line.trim(), x, y, MAX_WIDTH);
      if (linesTitle.length > i + 1) y += this.lineHeight() / GAP_TEXT;
      else y += this.lineHeight() / GAP_BLOCKS;
    });

    //add the rectangle with ripetibile
    const TextQuestActiveWidth =
      this.contents.measureTextWidth(" QUEST ATTIVA ") - 40;
    const TextQuestRepeatWidth =
      this.contents.measureTextWidth(" Ripetibile ") - 30;

    if (this._quest.repeatable) {
      this.contents.fontSize = 15;
      this.contents.fillRect(
        x,
        y,
        TextQuestRepeatWidth,
        this.itemHeight(),
        "rgba(0,50,150,1)",
      );
      this.changeTextColor(ColorManager.textColor(5));
      this.drawText(" Ripetibile", x, y, TextQuestRepeatWidth);
    }

    //Draw the "QUEST ATTIVA" block
    const tracked = $gameSystem.getTrackedQuest();
    if (this._quest.id === tracked) {
      this.contents.fontSize = 15;
      this.contents.fillRect(
        x + this._quest.repeatable ? TextQuestRepeatWidth + 10 : 0,
        y,
        TextQuestActiveWidth,
        this.itemHeight(),
        " rgba(0, 50, 0, 1)",
      );

      this.changeTextColor(ColorManager.textColor(3));
      this.drawText(
        " QUEST ATTIVA",
        x + this._quest.repeatable ? TextQuestRepeatWidth + 10 : 0,
        y,
        TextQuestActiveWidth,
      );
    }

    //if either is the tracked quest or a repeatable type add a gap
    if (this._quest.repeatable || this._quest.id === tracked) {
      y += this.lineHeight();
    }
    //Giver
    this.changeTextColor(ColorManager.systemColor());
    this.drawTextEx(
      "\\FS[18]\\c[1]Da: \\c[0]" + this._quest.giver,
      x,
      y,
      width,
    );

    y += this.lineHeight();

    //Location
    this.drawTextEx(
      "\\FS[18]\\c[1]Luogo: \\c[0]" + this._quest.questLocation,
      x,
      y,
      width,
    );

    y += this.lineHeight();

    //Desciption
    const linesDescription = wrapText(this._quest.description, MAX_WIDTH, this);

    linesDescription.forEach((line, i) => {
      this.drawText(line.trim(), x, y, MAX_WIDTH);
      if (linesDescription.length > i + 1) y += this.lineHeight() / GAP_TEXT;
      else y += this.lineHeight() / GAP_BLOCKS;
    });

    // Objectives
    this.contents.fontSize = 19;
    this.changeTextColor(ColorManager.textColor(3));

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
        this.contents.fontSize = 16;

        text = "✔ " + text;
        const linesObjective = wrapText(text, MAX_WIDTH, this);
        linesObjective.forEach((line, i) => {
          this.drawText(line.trim(), x + 5, y, MAX_WIDTH);
          if (linesObjective.length > i + 1) y += this.lineHeight() / GAP_TEXT;
          else y += this.lineHeight() / GAP_BLOCKS;
        });
      } else {
        //if the next step is not displayed it will draw it and set the variable to true to prevent the logic to draw all the successive step before the current one is completed
        if (!displayedStepToDo) {
          this.changeTextColor(ColorManager.normalColor());
          this.contents.fontSize = 16;

          text = "• " + text;
          const linesObjective = wrapText(text, MAX_WIDTH, this);
          linesObjective.forEach((line, i) => {
            this.drawText(line.trim(), x + 5, y, MAX_WIDTH);
            if (linesObjective.length > i + 1)
              y += this.lineHeight() / GAP_TEXT;
            else y += this.lineHeight() / GAP_BLOCKS;
          });
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
  const rect = new Rectangle(0, 0, 300, 60);
  this._questTrackerWindow = new Window_QuestTracker(rect);
  this.addWindow(this._questTrackerWindow);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////
//////*************** WINDOW QUEST TRACKER ****************************************/

function Window_QuestTracker() {
  this.initialize(...arguments);
}

Window_QuestTracker.prototype = Object.create(Window_Base.prototype);
Window_QuestTracker.prototype.constructor = Window_QuestTracker;

Window_QuestTracker.prototype.initialize = function (rect) {
  Window_Base.prototype.initialize.call(this, rect);
  this.refresh();
};

Window_QuestTracker.prototype.fittingHeightToText = function () {
  const trackedId = $gameSystem.getTrackedQuest();
  if (trackedId === null) return this.fittingHeight(1);

  const quest = $gameSystem.getQuests("active").find((q) => q.id === trackedId);

  if (!quest) return this.fittingHeight(1);

  const MAX_WIDTH = this.contentsWidth();

  let lines = 0;

  // TITLE
  this.contents.fontSize = 18;

  const titleLines = wrapText(quest.name, MAX_WIDTH, this);

  lines += titleLines.length;

  // CURRENT OBJECTIVE
  const obj = quest.objectives.find((o) => !o.done);

  if (obj) {
    this.contents.fontSize = 16;

    let text = obj.text;

    if (obj.max) {
      text += ` (${obj.progress}/${obj.max})`;
    }

    const objectiveLines = wrapText(text, MAX_WIDTH, this);

    lines += objectiveLines.length;
  }

  this.resetFontSettings();

  // + padding lines
  lines += 1;

  return this.fittingHeight(lines);
};

Window_QuestTracker.prototype.update = function () {
  Window_Base.prototype.update.call(this);

  const trackedId = $gameSystem.getTrackedQuest();

  // Hide window if nothing is tracked
  if (trackedId === null) {
    this.visible = false;
    return;
  }

  // Check if quest still exists in active list
  const quest = $gameSystem.getQuests("active").find((q) => q.id === trackedId);

  if (!quest) {
    this.opacity = Math.max(0, this.opacity - 20);
    return;
  } else {
    this.opacity = Math.min(255, this.opacity + 20);
  }

  if (this._lastTracked !== trackedId) {
    this._lastTracked = trackedId;
  }
  this.refresh();
};

Window_QuestTracker.prototype.refresh = function () {
  const newHeight = this.fittingHeightToText();
  if (this.height !== newHeight) {
    // the divide by 3 and the moltiplication by 2 are the closest that it can get to a perfect fit for the height, normaly it would be double the needed height otherwise.
    this.height = (newHeight / 3) * 2;
    this.createContents();
  }

  this.contents.clear();
  const MAX_WIDTH = 300;

  const trackedId = $gameSystem.getTrackedQuest();
  if (trackedId === null) return;
  const quest = $gameSystem.getQuests("active").find((q) => q.id === trackedId);
  if (!quest) return;

  let x = 0;
  let y = 0;

  //Title
  this.contents.fontSize = 18;
  this.changeTextColor(ColorManager.systemColor());
  const lines_quest = wrapText(quest.name, MAX_WIDTH, this);

  lines_quest.forEach((line, i) => {
    this.drawText(line.trim(), x, y, MAX_WIDTH);
    if (lines_quest.length > i + 1) y += this.lineHeight() / 1.5;
    else y += this.lineHeight() / 1.2;
  });

  //First imcolpete objective
  const obj = quest.objectives.find((objective) => !objective.done);
  this.contents.fontSize = 16;

  if (obj) {
    this.changeTextColor(ColorManager.normalColor());

    let text = obj.text;
    if (obj.max) {
      text += ` (${obj.progress}/${obj.max})`;
    }
    const lines_text = wrapText(text, MAX_WIDTH, this);

    lines_text.forEach((line, i) => {
      this.drawText(
        line.trim(),
        x,
        y + (i * this.lineHeight()) / 1.5,
        MAX_WIDTH,
      );
    });
  }
  this.resetFontSettings();
};

function wrapText(text, maxWidth, window) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  maxWidth -= 10;
  for (const word of words) {
    const testLine = currentLine + word + " ";

    const width = window.textWidth(testLine);

    if (width > maxWidth && currentLine !== "") {
      lines.push(currentLine);
      currentLine = word + " ";
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines;
}
