using System;
using System.Windows.Forms;

namespace NoteLiner.Lib.TextEdit
{
    public abstract class ShortcutKeyCommand : Command
    {

        public Keys ShortcutKeys { get; set; }

        // Action!
        public abstract void Execute(KeyEventArgs e);

    }
}
