using System;
using System.Collections.Generic;
using System.Text;

namespace NoteLiner.Lib.TextEdit.Command
{
    public class CommandManager
    {

        private Stack<CommandBase> undoStack;
        private Stack<CommandBase> redoStack;

        public CommandManager()
        {
            this.undoStack = new Stack<CommandBase>();
            this.redoStack = new Stack<CommandBase>();
        }

        public void ExecuteCommand(CommandBase command)
        {
            this.undoStack.Push(command);
            command.Execute();
        }



    }
}
