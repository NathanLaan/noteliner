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
        private Rectangle GutterRectangle { get; set; }
        private Rectangle TextRectangle { get; set; }

        // selection

        private Color selectionColor;

        private Keys modifiers;

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
            this.ProcessKeyEvent(e.KeyData);
            e.Handled = true;
            Invalidate();
        }


        private void ProcessKeyEvent(Keys keyData)
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
