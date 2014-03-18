using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace NoteLiner.Lib.TextEdit
{
    public partial class TextEditControl : UserControl
    {

        // Note: this could be set via a "theme"
        public Color GutterColor { get; set; }

        private int minLeft = 20;

        private Rectangle GutterRectangle {
            get
            {
                Rectangle rectangle = new Rectangle();
                rectangle.X = 0;
                rectangle.Y = 0;
                rectangle.Height = this.Height;
                rectangle.Width = this.minLeft;
                return rectangle;
            }
        }
        private Rectangle TextRectangle {
            get
            {
                Rectangle gutter = this.GutterRectangle;
                Rectangle rectangle = new Rectangle();
                rectangle.X = gutter.Width;
                rectangle.Y = 0;
                rectangle.Height = this.Height;
                rectangle.Width = this.Width - gutter.Width;
                return rectangle;
            }
        }

        // selection
        private Color selectionColor;

        //
        private Keys modifiers;

        // Shortcut keys
        private List<ShortcutKeyCommand> shortcutKeyList;

        public TextEditControl()
        {
            InitializeComponent();
            //
            SetStyle(ControlStyles.AllPaintingInWmPaint, true);
            SetStyle(ControlStyles.UserPaint, true);
            SetStyle(ControlStyles.OptimizedDoubleBuffer, true);
            SetStyle(ControlStyles.ResizeRedraw, true);
            //
            this.Font = new Font("Consolas", 10.0f, FontStyle.Regular, GraphicsUnit.Point);
            this.Cursor = Cursors.IBeam;
            this.BackColor = Color.White;
            base.AutoScroll = true;
            this.shortcutKeyList = new List<ShortcutKeyCommand>();
        }


        private bool keyEventHandled = false;


        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.Handled)
            {
                this.keyEventHandled = true;
                return;
            }
            if (base.Focused)
            {
                this.modifiers = e.Modifiers;
                this.keyEventHandled = false;
            }
            this.ProcessKeyEvent(e);
            e.Handled = true;
            Invalidate();
        }


        private void ProcessKeyEvent(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Tab)
            {
                return;
            }

            // loop through shortcut keys
            foreach (ShortcutKeyCommand shortcutKeyCommand in this.shortcutKeyList)
            {
            }

            //
        }

        private void InsertKeyChar(char c)
        {
        }


        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);


        }


        private void DrawBorder(Graphics graphics)
        {
        }

        private void DrawGutter(Graphics graphics)
        {
        }

    }
}
