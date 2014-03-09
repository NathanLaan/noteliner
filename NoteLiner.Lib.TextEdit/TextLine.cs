using System;
using System.Collections.Generic;
using System.Text;
using System.Drawing;

namespace NoteLiner.Lib.TextEdit
{
    public class TextLine : IList<TextChar>
    {

        // unique ID
        public int ID { get; private set; }

        protected List<TextChar> charList;

        public bool IsChanged { get; set; }


        
        public TextLine(int id)
        {
            this.ID = id;
            charList = new List<TextChar>();
        }


        public override string ToString()
        {
            StringBuilder sb = new StringBuilder(Count);
            foreach (TextChar c in this)
                sb.Append(c.Value);
            return sb.ToString();
        }



        public int IndexOf(TextChar item)
        {
            throw new NotImplementedException();
        }

        public void Insert(int index, TextChar item)
        {
            throw new NotImplementedException();
        }

        public void RemoveAt(int index)
        {
            throw new NotImplementedException();
        }

        public TextChar this[int index]
        {
            get
            {
                throw new NotImplementedException();
            }
            set
            {
                throw new NotImplementedException();
            }
        }

        public void Add(TextChar item)
        {
            throw new NotImplementedException();
        }

        public void Clear()
        {
            throw new NotImplementedException();
        }

        public bool Contains(TextChar item)
        {
            throw new NotImplementedException();
        }

        public void CopyTo(TextChar[] array, int arrayIndex)
        {
            throw new NotImplementedException();
        }

        public int Count
        {
            get { throw new NotImplementedException(); }
        }

        public bool IsReadOnly
        {
            get { throw new NotImplementedException(); }
        }

        public bool Remove(TextChar item)
        {
            throw new NotImplementedException();
        }

        public IEnumerator<TextChar> GetEnumerator()
        {
            throw new NotImplementedException();
        }

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
        {
            throw new NotImplementedException();
        }
    }
}
