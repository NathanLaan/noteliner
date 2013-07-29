using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace NoteLiner.App
{
    class Note
    {

        public bool Dirty { get; set; }
        public string Title { get; set; }
        public string Contents { get; set; }
        public DateTime Created { get; set; }
        public DateTime Updated { get; set; }

    }
}
