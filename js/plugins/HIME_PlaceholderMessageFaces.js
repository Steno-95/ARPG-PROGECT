/*:
-------------------------------------------------------------------------------
@title Placeholder Message Faces
@author Hime
@date Feb 2, 2016
@version 1.1
@filename HIME_PlaceholderMessageFaces.js
@url http://himeworks.com/2015/11/placeholder-message-faces/

If you enjoy my work, consider supporting me on Patreon!

* https://www.patreon.com/himeworks

If you have any questions or concerns, you can contact me at any of
the following sites:

* Main Website: http://himeworks.com
* Facebook: https://www.facebook.com/himeworkscom/
* Twitter: https://twitter.com/HimeWorks
* Youtube: https://www.youtube.com/c/HimeWorks
* Tumblr: http://himeworks.tumblr.com/

-------------------------------------------------------------------------------
@plugindesc v1.1 - Allows you to use placeholder graphics in your
messages that will dynamically display faces during the game.
@help 
-------------------------------------------------------------------------
== Description ==

In RPG Maker MV, you can create dialog through a series of messages.
To set up these messages, you would use the event editor's "Show Text"
command.

Here, you can type in the message you want to show, a face to go with it,
along with some other properties like the position of the message.

Now, what happens if you're making a game where players can choose who
they will use as the leader? For example, maybe your game offers
players the option to choose between a man or a woman, or from a set
of characters each with different backgrounds.

In these cases, it would be strange if the face shown in the dialog
didn't match the face of the player's chosen character.

However, now we have another problem: how do we actually set up our
messages to show different faces depending on the characters? Should
we just create conditional branches to handle every possible option?

But what if the players can submit their own custom faces for their
character? Now you would have no control over the graphics!

This plugin offers a solution that allows you to easily set up 
messages that will display the appropriate faces depending on the
actor's current face.

== Terms of Use ==

- Free for use in non-commercial projects with credits
- Contact me for commercial use

== Change Log ==

1.1 - Feb 2, 2015
  * added support for placeholder variables
1.0 - Nov 9, 2015
  * initial release

== Usage ==

We will be using images that will serve as placeholders. These images will
be replaced by correct images during the game.

You can draw anything on them yourself; what's important is the filename.
The purpose of the picture is just to make it obvious what it represents.

Then in your message box just use these pictures and the game will handle
the rest.

There are different types of placeholders available.

--- Placeholder Actors ---

This placeholder takes the face of a specific actor based on ID
Start by creating some images will serve as placeholders, and name them

  PlaceholderActor###
  
Where the ### is the ID of the actor. When the game needs to load that
face image, it will look up the specified actor's face.

For example, if you wanted to use the face of actor 32, you would use a
picture with the name

  PlaceholderActor32

--- Placeholder Party ---

This placeholder takes the face of an actor based on their position in their 
party.

The leader is in position 1. The second member is in position 2.
For example, if you wanted to show the leader in the message, you would use
a picture called

  PlaceholderParty1
   
--- Placeholder Variable ---

This placeholder uses the value of a variable to determine the ID of the
actor to show.

For example, to use variable 4 as your placeholder, you would use
a picture called

  PlaceholderVariable4
  
Now, if variable 4 contained the value 6, then actor 6's face would be used.
If variable 4 contained the value 12, it would use actor 12's face.
  
-------------------------------------------------------------------------------
 */ 
var Imported = Imported || {} ;
var TH = TH || {};
Imported.PlaceholderMessageFaces = 1;
TH.PlaceholderMessageFaces = TH.PlaceholderMessageFaces || {};

(function ($) {

  $.getPlaceholderActor = function(name) {    
    name = name.toLowerCase();
    if (name.startsWith("placeholderactor")) {
      var id = Math.floor(name.substring(16));
      return $gameActors.actor(id);
    }
    else if (name.startsWith("placeholderparty")) {
      var index = Math.floor(name.substring(16)) - 1;
      return $gameParty.members()[index];
    }
    else if (name.startsWith("placeholdervariable")) {
      var id = Math.floor(name.substring(19));
      return $gameActors.actor($gameVariables.value(id));
    }
  };

  var TH_PlaceholderMessageFaces_GameMessage_setFaceImage = Game_Message.prototype.setFaceImage;
  Game_Message.prototype.setFaceImage = function(faceName, faceIndex) {
    if (faceName.toLowerCase().startsWith("placeholder")) {
      var actor = $.getPlaceholderActor(faceName);
      faceName = actor.faceName();
      // faceIndex = actor.faceIndex()
    }
    TH_PlaceholderMessageFaces_GameMessage_setFaceImage.call(this, faceName, faceIndex);
  };
})(TH.PlaceholderMessageFaces);