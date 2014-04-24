using System;
using System.Collections.Generic;
using System.Text;
using NoteLiner.Lib.TextEdit.Ex;

namespace NoteLiner.Lib.TextEdit.Command
{
    public class CommandManager
    {

        public IExceptionManager ExceptionManager { get; set; }

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
            try
            {
                command.Execute();
            }
            catch (Exception e)
            {
                this.undoStack.Pop();
                if (this.ExceptionManager != null)
                {
                    this.ExceptionManager.HandleException(e);
                }
            }
        }



    }
}
