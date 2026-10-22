import sys
import os
import win32com.client

def convert_to_pdf(input_file, output_file):
    abs_input = os.path.abspath(input_file)
    abs_output = os.path.abspath(output_file)

    if not os.path.exists(abs_input):
        print(f"Error: File tidak ditemukan: {abs_input}", file=sys.stderr)
        sys.exit(1)

    ppt = None
    pres = None
    try:
        ppt = win32com.client.Dispatch("PowerPoint.Application")
        # 32 = ppSaveAsPDF
        pres = ppt.Presentations.Open(abs_input, WithWindow=False)
        pres.SaveAs(abs_output, 32)
        print("CONVERT_SUCCESS")
    except Exception as e:
        print(f"Error saat konversi PowerPoint: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        if pres:
            try:
                pres.Close()
            except:
                pass
        if ppt:
            try:
                ppt.Quit()
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_ppt.py <input.pptx> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    convert_to_pdf(sys.argv[1], sys.argv[2])
