using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NoteLiner.Lib.TextEdit
{
    public class TextFile
    {

        private readonly List<TextLine> textLineList = new List<TextLine>();

        public TextEditControl Control { get; set; }


        public event EventHandler<EventArgs> LineInserted;
        public event EventHandler<EventArgs> LineRemoved;
        public event EventHandler<EventArgs> TextChanging;
        public event EventHandler<EventArgs> TextChanged;


        public TextFile()
        {
        }


    }
}
