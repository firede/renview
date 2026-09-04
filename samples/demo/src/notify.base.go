package notify

import "fmt"

func SendOrderConfirmation(client *Client, order Order) error {
	if err := client.Connect(); err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	return client.Send(order.ReceiptEmail, renderReceipt(order))
}
