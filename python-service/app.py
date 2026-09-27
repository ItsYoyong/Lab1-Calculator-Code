import math

from flask import Flask, jsonify, request

app = Flask(__name__)


def calculation_response(status, payload, result, message):
    operation_input = {
        "num1": payload.get("num1"),
        "num2": payload.get("num2"),
        "operation": payload.get("operation"),
    }
    return {
        "status": status,
        "input": operation_input,
        "result": result,
        "message": message,
    }


@app.get("/ping")
def ping():
    return jsonify({"status": "ok", "message": "Python data worker is ready"})


@app.post("/calculate")
def calculate():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        payload = {}

    operation = payload.get("operation")
    num1 = payload.get("num1")
    num2 = payload.get("num2")
    supported_operations = {"add", "subtract", "multiply", "divide", "modulo", "power", "square_root"}

    if operation not in supported_operations:
        response = calculation_response("error", payload, None, "Unsupported or missing operation")
        return jsonify(response), 400

    numbers = [num1] if operation == "square_root" else [num1, num2]
    if any(
        isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
        for value in numbers
    ):
        response = calculation_response("error", payload, None, "Inputs must be finite numbers")
        return jsonify(response), 400

    try:
        if operation == "add":
            result = num1 + num2
        elif operation == "subtract":
            result = num1 - num2
        elif operation == "multiply":
            result = num1 * num2
        elif operation == "divide":
            if num2 == 0:
                raise ZeroDivisionError("Cannot divide by zero")
            result = num1 / num2
        elif operation == "modulo":
            if num2 == 0:
                raise ZeroDivisionError("Cannot take modulo by zero")
            result = num1 % num2
        elif operation == "power":
            result = num1**num2
        else:
            if num1 < 0:
                raise ValueError("Cannot calculate the square root of a negative number")
            result = math.sqrt(num1)

        if isinstance(result, complex) or not math.isfinite(result):
            raise ValueError("The result is outside the supported numeric range")
    except (OverflowError, ValueError, ZeroDivisionError) as error:
        response = calculation_response("error", payload, None, str(error))
        return jsonify(response), 400

    response = calculation_response("success", payload, result, "Calculation completed")
    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)