using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NoteLiner.Lib.TextEdit
{
    public class TextChar
    {

        public char Value { get; set; }
        public TextStyle Style { get; set; }

        public TextChar(char c)
        {
            this.Value = c;
        }
    }
}
