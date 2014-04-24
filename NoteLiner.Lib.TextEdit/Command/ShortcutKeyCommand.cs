using System;
using System.Windows.Forms;

namespace NoteLiner.Lib.TextEdit.Command
{
    public abstract class ShortcutKeyCommand
    {

        public Keys ShortcutKeys { get; set; }

        public CommandBase Command { get; set; }

    }
}
