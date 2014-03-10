using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NoteLiner.Lib.TextEdit
{
    public class TextLocation
    {

        public int LineNumber { get; set; }
        public int CharNumber { get; set; }
        
        public TextLocation(int lineNumber, int charNumber)
        {
            this.LineNumber = lineNumber;
            this.CharNumber = charNumber;
        }

    }

}