package notify

import "fmt"

func SendOrderConfirmation(client *Client, order Order) error {
	err := validate(order)
	if err != nil {
		return err
	}
	if err := client.Connect(); err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	return client.Send(order.ReceiptEmail, renderReceipt(order))
}
