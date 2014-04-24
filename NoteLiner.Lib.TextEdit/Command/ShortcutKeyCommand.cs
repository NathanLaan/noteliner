using System;
using System.Windows.Forms;

namespace NoteLiner.Lib.TextEdit.Command
{
    public abstract class ShortcutKeyCommand : CommandBase
    {

        public Keys ShortcutKeys { get; set; }

        // Action!
        public abstract void Execute(KeyEventArgs e);

    }
}
