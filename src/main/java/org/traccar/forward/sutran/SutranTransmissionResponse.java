package org.traccar.forward.sutran;

import java.util.List;

public class SutranTransmissionResponse {

    public static class ValidationError {

        private String path;
        private String txt;

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public String getTxt() {
            return txt;
        }

        public void setTxt(String txt) {
            this.txt = txt;
        }

    }

    private String crc;
    private int code;
    private String result;
    private List<ValidationError> error;

    public String getCrc() {
        return crc;
    }

    public void setCrc(String crc) {
        this.crc = crc;
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public List<ValidationError> getError() {
        return error;
    }

    public void setError(List<ValidationError> error) {
        this.error = error;
    }

}
